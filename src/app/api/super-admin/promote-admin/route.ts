import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/super-admin/promote-admin
 * Super admin promotes another user to super_admin by email.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role, display_name")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find target user
    const { data: targetUser } = await adminDb
      .from("users")
      .select("id, display_name, email, role")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ error: "You are already a Super Admin" }, { status: 400 });
    }

    if (targetUser.role === "super_admin") {
      return NextResponse.json({ error: "This user is already a Super Admin" }, { status: 400 });
    }

    // Promote
    await adminDb
      .from("users")
      .update({ role: "super_admin", is_admin: true })
      .eq("id", targetUser.id);

    // In-app notification
    await adminDb.from("notifications").insert({
      user_id: targetUser.id,
      message: `👑 You have been promoted to Super Admin on MoveUp by ${callerProfile.display_name ?? "an admin"}. You now have full platform access.`,
      is_read: false,
      type: "super_admin_promoted",
    });

    // Email notification
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass && targetUser.email) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"MoveUp Platform" <${smtpUser}>`,
          to: targetUser.email,
          subject: "👑 You've been promoted to Super Admin on MoveUp",
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
              <h2 style="color:#f59e0b;text-align:center;">Super Admin Access Granted</h2>
              <p>Hello ${targetUser.display_name ?? "there"},</p>
              <p>You have been promoted to <strong>Super Admin</strong> on the MoveUp platform by ${callerProfile.display_name ?? "an administrator"}.</p>
              <p>You now have full access to:</p>
              <ul>
                <li>Generate and manage partnership codes</li>
                <li>Monitor all partners and their staff</li>
                <li>Process withdrawal requests</li>
                <li>Reset rooms and manage platform settings</li>
              </ul>
              <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
              <p style="font-size:12px;color:#a1a1aa;text-align:center;">MoveUp Accountability Platform &copy; ${new Date().getFullYear()}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send promotion email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, promotedUser: targetUser.display_name ?? targetUser.email });
  } catch (err) {
    console.error("Promote admin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
