import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseServiceKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // 1. Authenticate sender using their Bearer JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing auth header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized user" }, { status: 401 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch sender profile
    const { data: senderProfile } = await adminDb
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const senderName = senderProfile?.display_name || "A room member";

    // 3. Verify sender is a member of the target room
    const { data: membership, error: membershipErr } = await adminDb
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (membershipErr || !membership) {
      return NextResponse.json({ error: "Forbidden: You are not a member of this room" }, { status: 403 });
    }

    // 4. Fetch the room and check cooldown
    const { data: room, error: roomErr } = await adminDb
      .from("rooms")
      .select("name, status, last_reminder_at")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "active") {
      return NextResponse.json({ error: "Room is no longer active" }, { status: 400 });
    }

    // 30-minute cooldown
    const COOLDOWN_MS = 30 * 60 * 1000;
    if (room.last_reminder_at) {
      const timeSinceLast = Date.now() - new Date(room.last_reminder_at).getTime();
      if (timeSinceLast < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - timeSinceLast;
        const remainingMins = Math.ceil(remainingMs / 60 / 1000);
        return NextResponse.json({
          error: `A reminder was sent recently. Please wait ${remainingMins} minute(s) before sending another one.`,
          cooldownRemaining: remainingMs
        }, { status: 429 });
      }
    }

    // 5. Fetch all other room members
    const { data: otherMembers, error: fetchMembersErr } = await adminDb
      .from("room_members")
      .select("user_id, users(email, display_name)")
      .eq("room_id", roomId)
      .neq("user_id", user.id);

    if (fetchMembersErr) {
      return NextResponse.json({ error: "Failed to fetch room members" }, { status: 500 });
    }

    const recipientCount = otherMembers?.length || 0;
    console.log(`[Remind API] Request by user ${user.id} inside room ${roomId}. Found ${recipientCount} other member(s) to notify.`);

    if (recipientCount > 0) {
      // 6. Insert in-app notifications
      console.log(`[Remind API] Creating in-app notifications for ${recipientCount} user(s)...`);
      const notificationsInsert = otherMembers.map((m: any) => ({
        user_id: m.user_id,
        room_id: roomId,
        message: `🔔 ${senderName} sent a reminder to complete your tasks in room "${room.name}"!`,
        is_read: false,
        type: "general"
      }));

      await adminDb.from("notifications").insert(notificationsInsert);

      // 7. Send SMTP Email notifications if configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        console.log(`[Remind API] SMTP is configured. Preparing to send email reminders...`);
        try {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.default.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: smtpUser, pass: smtpPass },
          });

          // Send emails asynchronously/concurrently
          const emailPromises = otherMembers.map((m: any) => {
            const email = m.users?.email;
            const displayName = m.users?.display_name || "Challenger";

            if (!email) {
              console.log(`[Remind API] Member ${m.user_id} has no email address set. Skipping.`);
              return Promise.resolve();
            }

            console.log(`[Remind API] Sending SMTP email reminder to ${email}...`);
            const mailOptions = {
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: email,
              subject: `🔔 Reminder: Complete your tasks in "${room.name}"`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px; background-color: #fafafa;">
                  <h2 style="color: #6d28d9; text-align: center; margin-bottom: 24px;">Task Reminder 🔔</h2>
                  <p>Hello <strong>${displayName}</strong>,</p>
                  <p>Your fellow challenger <strong>${senderName}</strong> has sent a reminder to everyone in the room <strong>"${room.name}"</strong> to complete and submit their tasks!</p>
                  <div style="background-color: #ffffff; border: 1px solid #eaeaea; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #4b5563;">Don't lose your commitment fee! Submit your proof of work and secure your share of the pool.</p>
                    <a href="${req.nextUrl.origin}/dashboard/tasks" style="display: inline-block; background-color: #6d28d9; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 16px; font-size: 14px;">View My Tasks</a>
                  </div>
                  <p>Keep pushing your goals forward,</p>
                  <p><strong>The MoveUp Team</strong></p>
                  <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin: 0;">MoveUp Accountability Platform &copy; ${new Date().getFullYear()}</p>
                </div>
              `,
            };

            return transporter.sendMail(mailOptions).then(() => {
              console.log(`[Remind API] Email reminder successfully sent to ${email}`);
            }).catch((err) => {
              console.error(`[Remind API] Failed to send reminder email to ${email}:`, err);
            });
          });

          await Promise.all(emailPromises);
        } catch (smtpErr) {
          console.error("[Remind API] SMTP Configuration or sending error:", smtpErr);
        }
      } else {
        console.log(`[Remind API] SMTP is not fully configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Skipping email dispatch.`);
      }
    } else {
      console.log(`[Remind API] No other members found in the room. No emails or notifications to send.`);
    }

    // 8. Update room's last_reminder_at timestamp
    const nowStr = new Date().toISOString();
    await adminDb
      .from("rooms")
      .update({ last_reminder_at: nowStr })
      .eq("id", roomId);

    return NextResponse.json({
      success: true,
      recipientsNotified: recipientCount,
      lastReminderAt: nowStr
    });

  } catch (err) {
    console.error("Nudge API handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
