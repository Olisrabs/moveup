import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/partner/staff-respond
 * Staff user accepts or rejects a pending invitation.
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

    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { invitationId, action } = body;

    if (!invitationId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "invitationId and action (accept|reject) are required" }, { status: 400 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch invitation — must belong to this user
    const { data: invitation, error: fetchErr } = await adminDb
      .from("staff_invitations")
      .select("*, partner:partner_id(display_name, business_name, email)")
      .eq("id", invitationId)
      .eq("staff_user_id", user.id)
      .eq("status", "pending")
      .single();

    if (fetchErr || !invitation) {
      return NextResponse.json({ error: "Invitation not found or already responded" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "accept") {
      // 3a. Update invitation
      await adminDb
        .from("staff_invitations")
        .update({ status: "accepted", responded_at: now })
        .eq("id", invitationId);

      // 3b. Promote user to staff
      await adminDb
        .from("users")
        .update({ role: "staff", partner_id: invitation.partner_id })
        .eq("id", user.id);

      // 3c. Notify partner
      const partnerName = (invitation.partner as any)?.business_name || (invitation.partner as any)?.display_name || "You";
      const { data: staffProfile } = await adminDb
        .from("users")
        .select("display_name")
        .eq("id", user.id)
        .single();

      await adminDb.from("notifications").insert({
        user_id: invitation.partner_id,
        message: `✅ ${staffProfile?.display_name ?? invitation.staff_email} accepted your staff invitation and is now part of your team!`,
        is_read: false,
        type: "staff_accepted",
      });

      // 3d. In-app confirmation to staff
      await adminDb.from("notifications").insert({
        user_id: user.id,
        message: `🎉 You are now staff for ${partnerName} on MoveUp. You can join rooms as an observer without paying commitment fees.`,
        is_read: false,
        type: "staff_role_granted",
      });

      return NextResponse.json({ success: true, action: "accepted" });
    } else {
      // 4a. Reject
      await adminDb
        .from("staff_invitations")
        .update({ status: "rejected", responded_at: now })
        .eq("id", invitationId);

      // 4b. Notify partner
      const { data: staffProfile } = await adminDb
        .from("users")
        .select("display_name")
        .eq("id", user.id)
        .single();

      await adminDb.from("notifications").insert({
        user_id: invitation.partner_id,
        message: `❌ ${staffProfile?.display_name ?? invitation.staff_email} declined your staff invitation.`,
        is_read: false,
        type: "staff_rejected",
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (err) {
    console.error("Staff respond error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
