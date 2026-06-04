import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Supabase admin client (bypasses RLS — server only)
// ---------------------------------------------------------------------------
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to write debug information to a local file for inspection
function saveDebugInfo(data: any) {
  try {
    const filePath = path.join(process.cwd(), "gemini-debug.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`[score-task] Saved debug info to ${filePath}`);
  } catch (err) {
    console.error("[score-task] Failed to write debug file:", err);
  }
}

// ---------------------------------------------------------------------------
// Helper: Extract valid JSON substring from text
// E.g., extracts "{...}" from conversation or markdown fences
// ---------------------------------------------------------------------------
function extractJSON(raw: string): string {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.substring(firstBrace, lastBrace + 1);
  }
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

// ---------------------------------------------------------------------------
// POST /api/score-task
// Body: { task_id, user_id, room_id, task_title, task_description?,
//         proof_type, proof_text?, proof_url? }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let score: number = 10;
  let reasoning: string = "AI scoring encountered a parsing issue. A base score was awarded.";
  let debugData: any = {};

  try {
    const body = await req.json();
    const {
      task_id,
      user_id,
      room_id,
      task_title,
      task_description,
      proof_type,
      proof_text,
      proof_url,
    } = body;

    debugData.request_body = body;

    if (!task_id || !user_id || !room_id || !task_title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // 1. Build the Gemini evaluation prompt
    // -----------------------------------------------------------------------
    let proofDetail = "";
    if (proof_type === "text") {
      proofDetail = `The user's written proof description: "${proof_text ?? "(none)"}"`;
    } else if (proof_type === "link") {
      proofDetail = `The user submitted this link as proof: "${proof_url ?? "(none)"}"`;
    } else {
      proofDetail = `The user uploaded an image screenshot as proof. (The image data is attached directly below).`;
    }

    const prompt = `You are a fair, expert judge for an accountability challenge platform called MoveUp.
A user has submitted proof of completing a task. Evaluate the task and the proof, then return ONLY a valid JSON object.

Task Title: "${task_title}"
Task Description: "${task_description ?? "No description provided."}"
Proof Type: ${proof_type}
${proofDetail}

Scoring Rules:
- Score is a percentage (a number between 0 and 100) awarded for THIS SINGLE task.
- Evaluate based on: (1) task complexity & depth, (2) effort required, (3) proof quality & detail, (4) specificity of what was done.
- A task like "drink water" with no context scores 2-10%. BUT if the user specifies "drink 8 cups of water, tracked each cup in the proof", that shows more effort and scores higher.
- Simple/vague tasks with thin proof: 2-15%
- Moderate tasks with decent proof: 15-40%
- Substantial tasks with clear, detailed proof: 40-70%
- Complex, multi-step, impressive tasks with strong proof: 70-100%
- ALWAYS base the score on what you actually see in the title + description + proof. If an image is attached, inspect it to verify execution and effort.

You must respond with ONLY this JSON structure (no markdown fences, no conversational text, no other characters):
{
  "score": <number 0-100>,
  "reasoning": "<1-2 sentence explanation of why this score was given, mentioning specifics from the task/proof>"
}`;

    // -----------------------------------------------------------------------
    // 2. Fetch and prepare image proof if available (Multimodal support)
    // -----------------------------------------------------------------------
    let imagePart: any = null;
    if (proof_type === "image" && proof_url) {
      try {
        console.log(`[score-task] Downloading image proof: ${proof_url}`);
        const imgRes = await fetch(proof_url);
        if (imgRes.ok) {
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          imagePart = {
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          };
          debugData.image_download = "success";
        } else {
          debugData.image_download = `failed: ${imgRes.status}`;
        }
      } catch (e: any) {
        debugData.image_download_error = e.message;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Call Google Gemini API (Gemini 2.5 Flash)
    // -----------------------------------------------------------------------
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const contentsParts: any[] = [{ text: prompt }];
    if (imagePart) {
      contentsParts.push(imagePart);
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      debugData.gemini_res_error = errText;
      saveDebugInfo(debugData);
      return NextResponse.json(
        { error: "Failed to reach Gemini API", detail: errText },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    debugData.gemini_api_response = geminiData;
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    debugData.raw_text_extracted = rawText;

    // -----------------------------------------------------------------------
    // 4. Parse Gemini response
    // -----------------------------------------------------------------------
    try {
      const cleaned = extractJSON(rawText);
      const parsed = JSON.parse(cleaned);
      score = Math.min(100, Math.max(0, Number(parsed.score ?? 0)));
      reasoning = String(parsed.reasoning ?? "No reasoning provided.");
      debugData.parse_status = "success";
      debugData.parsed_score = score;
      debugData.parsed_reasoning = reasoning;
    } catch (e: any) {
      debugData.parse_status = "failed";
      debugData.parse_error = e.message;
      saveDebugInfo(debugData);
    }

    // Save final state
    saveDebugInfo(debugData);

    // -----------------------------------------------------------------------
    // 5. Persist: update tasks table with the score + breakdown
    // -----------------------------------------------------------------------
    const { error: taskErr } = await supabaseAdmin
      .from("tasks")
      .update({ score_percentage: score, score_breakdown: reasoning })
      .eq("id", task_id);

    if (taskErr) {
      console.error("Error updating task score:", taskErr);
      return NextResponse.json(
        { error: "Failed to save task score", detail: taskErr.message },
        { status: 500 }
      );
    }

    // -----------------------------------------------------------------------
    // 6. Atomic increment of room_members.ai_score
    // -----------------------------------------------------------------------
    const { data: memberRow, error: fetchErr } = await supabaseAdmin
      .from("room_members")
      .select("id, ai_score")
      .eq("room_id", room_id)
      .eq("user_id", user_id)
      .single();

    if (fetchErr) {
      console.error("Error fetching room_member row:", fetchErr.message);
    } else {
      const currentScore = Number(memberRow?.ai_score ?? 0);
      const newScore = parseFloat((currentScore + score).toFixed(2));

      const { error: updateErr } = await supabaseAdmin
        .from("room_members")
        .update({ ai_score: newScore })
        .eq("id", memberRow.id);

      if (updateErr) {
        console.error("Error updating room_member ai_score:", updateErr.message);
      }
    }

    // -----------------------------------------------------------------------
    // 7. Return the result to the frontend
    // -----------------------------------------------------------------------
    return NextResponse.json({ score, reasoning });
  } catch (err: any) {
    console.error("Unexpected error in /api/score-task:", err);
    debugData.unexpected_error = err.message;
    saveDebugInfo(debugData);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
