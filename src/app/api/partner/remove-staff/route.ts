import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/partner/remove-staff
 * Partner or super_admin removes a staff member or revokes an invitation.
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
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify caller is partner or super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role, display_name, business_name")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !["partner", "super_admin"].includes(callerProfile.role)) {
      return NextResponse.json({ error: "Forbidden: only partners can manage staff" }, { status: 403 });
    }

    const body = await req.json();
    const { invitationId } = body;
    if (!invitationId) return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 });

    // 3. Fetch the invitation
    const { data: invitation, error: fetchErr } = await adminDb
      .from("staff_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchErr || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Ensure partner only manages their own staff (unless they are super_admin)
    if (callerProfile.role !== "super_admin" && invitation.partner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden: you do not own this invitation" }, { status: 403 });
    }

    const staffUserId = invitation.staff_user_id;

    // 4. If the invitation was accepted, demote the user back to "user"
    if (invitation.status === "accepted" && staffUserId) {
      // Check if user's current role is staff and they belong to this partner
      const { data: staffProfile } = await adminDb
        .from("users")
        .select("role, partner_id")
        .eq("id", staffUserId)
        .single();

      if (staffProfile && staffProfile.role === "staff" && staffProfile.partner_id === invitation.partner_id) {
        await adminDb
          .from("users")
          .update({ role: "user", partner_id: null })
          .eq("id", staffUserId);

        // Notify the user in-app
        const partnerName = callerProfile.business_name || callerProfile.display_name || "Their partner";
        await adminDb.from("notifications").insert({
          user_id: staffUserId,
          message: `🚫 Your staff access for ${partnerName} has been removed. You are now a regular member.`,
          is_read: false,
          type: "staff_revoked",
        });
      }
    }

    // 5. Delete the invitation record
    const { error: deleteErr } = await adminDb
      .from("staff_invitations")
      .delete()
      .eq("id", invitationId);

    if (deleteErr) {
      return NextResponse.json({ error: "Failed to remove invitation record" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove staff error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
