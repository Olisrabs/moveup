import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/reset-rooms
 * Admin-only endpoint to checkout all users from active rooms and notify them of the real-money system policy.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseServiceKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // 1. Verify User Authentication
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

    // 2. Verify Super Admin Status
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userProfile, error: profileErr } = await adminDb
      .from("users")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !userProfile || (!userProfile.is_admin && userProfile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    // 3. Find all users in rooms before deleting memberships
    const { data: members, error: fetchMembersErr } = await adminDb
      .from("room_members")
      .select("user_id, users(email, display_name)");

    if (fetchMembersErr) {
      return NextResponse.json({ error: "Failed to fetch room members" }, { status: 500 });
    }

    // Unique user list
    const uniqueUsersMap = new Map<string, { email: string; display_name: string }>();
    if (members && members.length > 0) {
      members.forEach((m: any) => {
        if (m.user_id && m.users) {
          uniqueUsersMap.set(m.user_id, {
            email: m.users.email || "",
            display_name: m.users.display_name || "Member",
          });
        }
      });
    }

    const affectedUsersCount = uniqueUsersMap.size;

    if (affectedUsersCount > 0) {
      // 4. Create in-app notifications
      const notificationsInsert = Array.from(uniqueUsersMap.entries()).map(([userId, info]) => ({
        user_id: userId,
        message: `⚠️ Action Required: MoveUp has transitioned to a real-money system. To maintain fairness, all users have been checked out of active rooms. Please fund your wallet and re-join your rooms with the commitment fee.`,
        is_read: false,
        type: "system_policy_reset",
      }));

      await adminDb.from("notifications").insert(notificationsInsert);

      // 5. Send Email Notifications if SMTP is configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.default.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: smtpUser, pass: smtpPass },
          });

          // Send emails asynchronously in the background so we don't timeout the HTTP response
          const emailPromises = Array.from(uniqueUsersMap.entries()).map(([_, info]) => {
            if (!info.email) return Promise.resolve();

            const mailOptions = {
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: info.email,
              subject: "⚠️ MoveUp Policy Update: Action Required to Re-join Rooms",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; rounded: 8px;">
                  <h2 style="color: #6d28d9; text-align: center;">MoveUp Policy Update</h2>
                  <p>Hello ${info.display_name},</p>
                  <p>We are writing to inform you that MoveUp has officially completed its migration to a <strong>real-money wallet system (₦)</strong>.</p>
                  <p>To ensure system integrity and fairness, <strong>all previous room memberships have been reset</strong>. If you were active in any rooms, you have been checked out.</p>
                  <p><strong>To join your rooms back and start competing again:</strong></p>
                  <ol>
                    <li>Log in to your account at <a href="${req.nextUrl.origin}" style="color: #6d28d9; font-weight: bold;">MoveUp</a>.</li>
                    <li>Go to your <strong>Wallet</strong> and fund your account using our secure Paystack gateway.</li>
                    <li>Enter the room code to join back and pay the required commitment fee.</li>
                  </ol>
                  <p>Thank you for your cooperation and dedication to building positive habits!</p>
                  <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #a1a1aa; text-align: center;">MoveUp Accountability Platform &copy; ${new Date().getFullYear()}</p>
                </div>
              `,
            };

            return transporter.sendMail(mailOptions).catch(err => {
              console.error(`Failed to send reset email to ${info.email}:`, err);
            });
          });

          // Wait for all email deliveries to complete or fail
          await Promise.all(emailPromises);
        } catch (smtpErr) {
          console.error("Nodemailer transporter error:", smtpErr);
        }
      }
    }

    // 6. Delete all rows in room_members to checkout everyone
    const { error: deleteErr } = await adminDb
      .from("room_members")
      .delete()
      .neq("user_id", "00000000-0000-0000-0000-000000000000"); // Standard way to target all rows

    if (deleteErr) {
      console.error("Failed to delete room members:", deleteErr);
      return NextResponse.json({ error: "Failed to checkout members from rooms" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      affectedUsers: affectedUsersCount,
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    });
  } catch (err) {
    console.error("Reset rooms handler error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
