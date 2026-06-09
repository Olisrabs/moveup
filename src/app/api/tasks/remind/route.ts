import { NextRequest, NextResponse } from "next/server";

// ── Motivational quotes pool ──────────────────────────────────────────────────
const MOTIVATIONAL_QUOTES = [
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Anonymous" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Anonymous" },
  { quote: "Great things never come from comfort zones.", author: "Anonymous" },
  { quote: "Dream it. Wish it. Do it.", author: "Anonymous" },
  { quote: "Success doesn't just find you. You have to go out and get it.", author: "Anonymous" },
  { quote: "The key to success is to focus on goals, not obstacles.", author: "Anonymous" },
  { quote: "Dream bigger. Do bigger.", author: "Anonymous" },
  { quote: "Little things make big days.", author: "Anonymous" },
  { quote: "It's going to be hard, but hard does not mean impossible.", author: "Anonymous" },
  { quote: "Don't stop when you're tired. Stop when you're done.", author: "Anonymous" },
  { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Anonymous" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { quote: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "You are never too old to set another goal or dream a new dream.", author: "C.S. Lewis" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
];

function getRandomQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
}

// ── Route handler ─────────────────────────────────────────────────────────────
/**
 * POST /api/tasks/remind
 *
 * Body (JSON):
 *   { type: "completion_reminder" | "time_reminder", taskId: string }
 *
 * - completion_reminder: Sends the calling user a motivational reminder to
 *   complete their pending task (in-app notification + optional email).
 * - time_reminder: Marks that a "15-min-before" reminder was sent for a
 *   scheduled task and records the timestamp to prevent duplicates.
 *
 * Requires: Authorization: Bearer <supabase_jwt>
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, taskId } = body as { type: string; taskId: string };

    if (!type || !taskId) {
      return NextResponse.json({ error: "type and taskId are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing auth header" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the task — verify ownership
    const { data: task, error: taskErr } = await adminDb
      .from("tasks")
      .select("id, title, user_id, status, scheduled_time, last_reminder_sent_at")
      .eq("id", taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Completion reminder ───────────────────────────────────────────────────
    if (type === "completion_reminder") {
      if (task.status === "completed") {
        return NextResponse.json({ skipped: true, reason: "Task already completed" });
      }

      // ── Server-side 3-hour throttle (DB-based, survives page reloads) ──
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
      if (task.last_reminder_sent_at) {
        const msSince = Date.now() - new Date(task.last_reminder_sent_at).getTime();
        if (msSince < THREE_HOURS_MS) {
          const remainingMins = Math.ceil((THREE_HOURS_MS - msSince) / 60_000);
          return NextResponse.json({
            skipped: true,
            reason: `Reminder already sent. Next one in ${remainingMins} minute(s).`,
          });
        }
      }

      const quote = getRandomQuote();
      const nowIso = new Date().toISOString();

      // Write timestamp FIRST to prevent race-condition double-sends
      await adminDb
        .from("tasks")
        .update({ last_reminder_sent_at: nowIso })
        .eq("id", task.id);

      await adminDb.from("notifications").insert({
        user_id: user.id,
        task_id: task.id,
        room_id: null,
        message: `⏰ Reminder: "${task.title}" is still pending.\n💬 "${quote.quote}" — ${quote.author}`,
        is_read: false,
        type: "task_reminder",
      });

      // Optional email
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const { data: userProfile } = await adminDb
            .from("users")
            .select("email, display_name")
            .eq("id", user.id)
            .single();

          if (userProfile?.email) {
            // @ts-ignore
            const nodemailer = (await import("nodemailer")) as any;
            const transporter = nodemailer.default.createTransport({
              host: smtpHost,
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: { user: smtpUser, pass: smtpPass },
            });

            await transporter.sendMail({
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: userProfile.email,
              subject: `⏰ Don't forget: "${task.title}"`,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #eaeaea;border-radius:12px;background:#fafafa;">
                  <h2 style="color:#6d28d9;text-align:center;">Task Reminder ⏰</h2>
                  <p>Hello <strong>${userProfile.display_name || "Challenger"}</strong>,</p>
                  <p>You still have a pending task: <strong>"${task.title}"</strong>. Don't let it slip!</p>
                  <div style="background:#ede9fe;border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
                    <p style="font-style:italic;color:#5b21b6;font-size:15px;">"${quote.quote}"</p>
                    <p style="color:#7c3aed;font-size:13px;margin:8px 0 0;">— ${quote.author}</p>
                  </div>
                  <div style="text-align:center;margin-top:20px;">
                    <a href="${req.nextUrl.origin}/dashboard/tasks"
                       style="background:#6d28d9;color:#fff;padding:12px 28px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:14px;">
                      Complete My Task
                    </a>
                  </div>
                  <hr style="border:0;border-top:1px solid #eaeaea;margin:24px 0;">
                  <p style="font-size:12px;color:#a1a1aa;text-align:center;">MoveUp Accountability Platform &copy; ${new Date().getFullYear()}</p>
                </div>
              `,
            });
          }
        } catch (emailErr) {
          console.error("[Tasks/Remind] Email error:", emailErr);
        }
      }

      return NextResponse.json({ success: true, type: "completion_reminder", quote });
    }

    // ── Time-based reminder (15 min before scheduled_time) ───────────────────
    if (type === "time_reminder") {
      if (!task.scheduled_time) {
        return NextResponse.json({ skipped: true, reason: "No scheduled time on task" });
      }
      if (task.status === "completed") {
        return NextResponse.json({ skipped: true, reason: "Task already completed" });
      }

      // Throttle: don't send more than once per 50 minutes for time reminders
      if (task.last_reminder_sent_at) {
        const msSince = Date.now() - new Date(task.last_reminder_sent_at).getTime();
        if (msSince < 50 * 60 * 1000) {
          return NextResponse.json({ skipped: true, reason: "Reminder already sent recently" });
        }
      }

      const quote = getRandomQuote();

      await adminDb.from("notifications").insert({
        user_id: user.id,
        task_id: task.id,
        room_id: null,
        message: `🕐 Your task "${task.title}" starts in about 15 minutes! Get ready.\n💬 "${quote.quote}" — ${quote.author}`,
        is_read: false,
        type: "time_reminder",
      });

      // Record that we sent a reminder
      await adminDb
        .from("tasks")
        .update({ last_reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);

      return NextResponse.json({ success: true, type: "time_reminder", quote });
    }

    return NextResponse.json({ error: "Unknown reminder type" }, { status: 400 });

  } catch (err) {
    console.error("[Tasks/Remind] Handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
