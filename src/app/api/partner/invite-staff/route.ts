import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/partner/invite-staff
 * Partner or super_admin invites a registered MoveUp user to become staff.
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

    // 1. Auth check
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

    // 2. Verify caller is partner or super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role, display_name, business_name")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !["partner", "super_admin"].includes(callerProfile.role)) {
      return NextResponse.json({ error: "Forbidden: only partners can invite staff" }, { status: 403 });
    }

    const body = await req.json();
    const { staffEmail } = body;
    if (!staffEmail) return NextResponse.json({ error: "Staff email is required" }, { status: 400 });

    const email = staffEmail.trim().toLowerCase();

    // 3. Find the staff user by email — must already be registered
    const { data: staffUser } = await adminDb
      .from("users")
      .select("id, email, display_name, role")
      .eq("email", email)
      .single();

    if (!staffUser) {
      return NextResponse.json({
        error: "No MoveUp account found with that email. The user must sign up first.",
      }, { status: 404 });
    }

    if (staffUser.id === user.id) {
      return NextResponse.json({ error: "You cannot invite yourself as staff" }, { status: 400 });
    }

    if (["partner", "super_admin"].includes(staffUser.role)) {
      return NextResponse.json({ error: "This user is already a partner or admin" }, { status: 400 });
    }

    // 4. Check for existing pending invitation
    const { data: existing } = await adminDb
      .from("staff_invitations")
      .select("id, status")
      .eq("partner_id", user.id)
      .eq("staff_email", email)
      .eq("status", "pending")
      .single();

    if (existing) {
      return NextResponse.json({ error: "A pending invitation already exists for this user" }, { status: 400 });
    }

    // 5. Create invitation
    const { data: invitation, error: inviteErr } = await adminDb
      .from("staff_invitations")
      .insert({
        partner_id: user.id,
        staff_email: email,
        staff_user_id: staffUser.id,
        status: "pending",
      })
      .select()
      .single();

    if (inviteErr || !invitation) {
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }

    // 6. In-app notification to staff user
    const partnerName = callerProfile.business_name || callerProfile.display_name || "A partner";
    await adminDb.from("notifications").insert({
      user_id: staffUser.id,
      message: `🤝 ${partnerName} has invited you to join as Staff on MoveUp. Go to your Profile page to accept or decline.`,
      is_read: false,
      type: "staff_invitation",
    });

    // 7. Send email if SMTP configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass && staffUser.email) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        });

        const profileUrl = `${req.nextUrl.origin}/dashboard/profile`;
        await transporter.sendMail({
          from: `"MoveUp Platform" <${smtpUser}>`,
          to: staffUser.email,
          subject: `🤝 You've been invited to join as MoveUp Staff`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
              <h2 style="color:#6d28d9;text-align:center;">Staff Invitation</h2>
              <p>Hello ${staffUser.display_name ?? "there"},</p>
              <p><strong>${partnerName}</strong> has invited you to become a <strong>Staff member</strong> on the MoveUp accountability platform.</p>
              <p>As a staff member, you can:</p>
              <ul>
                <li>Join rooms without paying a commitment fee</li>
                <li>Monitor member task progress and proof submissions</li>
                <li>Send notifications to room members</li>
              </ul>
              <p>Visit your profile page to accept or decline this invitation:</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${profileUrl}" style="background:#6d28d9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                  View Invitation
                </a>
              </div>
              <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
              <p style="font-size:12px;color:#a1a1aa;text-align:center;">MoveUp Accountability Platform &copy; ${new Date().getFullYear()}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send staff invitation email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, invitationId: invitation.id });
  } catch (err) {
    console.error("Invite staff error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
