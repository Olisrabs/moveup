import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const diagnostics: Record<string, any> = {};
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Check environment variables
    diagnostics.env = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_API_KEY: !!geminiKey,
      GEMINI_API_KEY_PREFIX: geminiKey ? geminiKey.substring(0, 7) + "..." : "missing",
    };

    // 2. Fetch list of available models for this key
    if (geminiKey && geminiKey !== "your_key_here") {
      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          diagnostics.available_models = listData.models?.map((m: any) => ({
            name: m.name,
            displayName: m.displayName,
            supportedMethods: m.supportedGenerationMethods,
          })) || [];
        } else {
          diagnostics.list_models_error = {
            status: listRes.status,
            error: await listRes.text(),
          };
        }
      } catch (e: any) {
        diagnostics.list_models_error = { error: e.message };
      }
    }

    // 3. Check room_members schema by fetching one row
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("room_members")
      .select("*")
      .limit(1);

    if (memberError) {
      diagnostics.room_members_table = { status: "error", error: memberError.message };
    } else if (memberData && memberData.length > 0) {
      const sample = memberData[0];
      diagnostics.room_members_table = {
        status: "ok",
        has_ai_score_column: "ai_score" in sample,
        columns_found: Object.keys(sample),
      };
    }

    // 4. Check tasks schema by fetching one row
    const { data: taskData, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .limit(1);

    if (taskError) {
      diagnostics.tasks_table = { status: "error", error: taskError.message };
    } else if (taskData && taskData.length > 0) {
      const sample = taskData[0];
      diagnostics.tasks_table = {
        status: "ok",
        has_score_percentage_column: "score_percentage" in sample,
        has_score_breakdown_column: "score_breakdown" in sample,
        columns_found: Object.keys(sample),
      };
    }

    // 5. Test Google Gemini scoring and inspect the raw output
    if (geminiKey && geminiKey !== "your_key_here") {
      try {
        const testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a fair, expert judge for an accountability challenge platform.
Return ONLY a valid JSON object — nothing else.

Task Title: "Drink water"
Task Description: "Drink 8 cups of water"
Proof Type: text
The user's written proof: "Drank 8 cups throughout the day"

Return ONLY this JSON:
{
  "score": 45,
  "reasoning": "Completed the task as described with text proof."
}`
                }]
              }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 300,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (testRes.ok) {
          const geminiData = await testRes.json();
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          
          let parsed = null;
          let parseError = null;
          try {
            parsed = JSON.parse(rawText.trim());
          } catch (e: any) {
            parseError = e.message;
          }

          diagnostics.gemini_test_score = {
            status: "ok",
            raw_response_text: rawText,
            parsed_json: parsed,
            parse_error: parseError,
          };
        } else {
          diagnostics.gemini_test_score = {
            status: "failed",
            status_code: testRes.status,
            error: await testRes.text(),
          };
        }
      } catch (e: any) {
        diagnostics.gemini_test_score = { status: "error", error: e.message };
      }
    }

    return NextResponse.json(diagnostics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
