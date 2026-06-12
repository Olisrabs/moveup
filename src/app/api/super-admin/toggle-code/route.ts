import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/super-admin/toggle-code
 * Enable or disable a partnership code. Disabling also revokes the partner's role.
 */
export async function PATCH(req: NextRequest) {
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
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { codeId, isActive } = body;

    if (!codeId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "codeId and isActive (boolean) are required" }, { status: 400 });
    }

    // Fetch the code
    const { data: codeRecord } = await adminDb
      .from("partnership_codes")
      .select("*")
      .eq("id", codeId)
      .single();

    if (!codeRecord) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }

    // Toggle the code
    await adminDb
      .from("partnership_codes")
      .update({ is_active: isActive })
      .eq("id", codeId);

    // If disabling and code was already redeemed — revoke the partner's role
    if (!isActive && codeRecord.used_by) {
      await adminDb
        .from("users")
        .update({
          role: "user",
          business_name: null,
          partner_id: null,
          partnership_expires_at: null,
        })
        .eq("id", codeRecord.used_by)
        .eq("role", "partner"); // Only revert if still partner (don't touch super_admins)

      // Notify the partner
      await adminDb.from("notifications").insert({
        user_id: codeRecord.used_by,
        message: `⚠️ Your MoveUp partnership access has been suspended by the administrator. Your account has been returned to a standard user profile.`,
        is_read: false,
        type: "partnership_suspended",
      });

      // Also revoke staff who belong to this partner
      await adminDb
        .from("users")
        .update({ role: "user", partner_id: null })
        .eq("partner_id", codeRecord.used_by)
        .eq("role", "staff");
    }

    // If re-enabling and code was redeemed — restore partner role
    if (isActive && codeRecord.used_by) {
      const { data: partnerUser } = await adminDb
        .from("users")
        .select("role")
        .eq("id", codeRecord.used_by)
        .single();

      if (partnerUser?.role === "user") {
        await adminDb
          .from("users")
          .update({
            role: "partner",
            business_name: codeRecord.business_name,
            partnership_expires_at: codeRecord.expires_at,
          })
          .eq("id", codeRecord.used_by);

        await adminDb.from("notifications").insert({
          user_id: codeRecord.used_by,
          message: `✅ Your MoveUp partnership access has been restored. Welcome back, partner!`,
          is_read: false,
          type: "partnership_restored",
        });
      }
    }

    return NextResponse.json({ success: true, isActive });
  } catch (err) {
    console.error("Toggle code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
