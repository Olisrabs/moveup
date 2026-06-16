import { NextRequest, NextResponse } from "next/server";

/** Shared helper: verifies the Bearer token and returns { adminDb, error } */
async function getAdminDb(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return { adminDb: null, error: NextResponse.json({ error: "Database not configured" }, { status: 500 }) };
  }

  const { createClient } = await import("@supabase/supabase-js");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { adminDb: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return { adminDb: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const adminDb = createClient(supabaseUrl, supabaseServiceKey);

  const { data: callerProfile } = await adminDb
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "super_admin") {
    return { adminDb: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { adminDb, error: null };
}

/**
 * PATCH /api/super-admin/codes/[id]
 * Edit a partnership code's business name, duration, and expiry date.
 * Only unused (not yet redeemed) fields are safe to freely edit;
 * if the code was redeemed the partner's business_name is also updated.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminDb, error } = await getAdminDb(req);
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { businessName, durationDays, expiresAt } = body;

    if (!businessName?.trim() || !durationDays || !expiresAt) {
      return NextResponse.json(
        { error: "businessName, durationDays, and expiresAt are required" },
        { status: 400 }
      );
    }

    if (Number(durationDays) < 1) {
      return NextResponse.json({ error: "durationDays must be at least 1" }, { status: 400 });
    }

    // Fetch existing code to check if it was redeemed
    const { data: existing } = await adminDb!
      .from("partnership_codes")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }

    // Update the code record
    const { data: updated, error: updateErr } = await adminDb!
      .from("partnership_codes")
      .update({
        business_name: businessName.trim(),
        duration_days: Number(durationDays),
        expires_at: new Date(expiresAt).toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Propagate business name change to the partner who redeemed this code
    if (existing.used_by) {
      await adminDb!
        .from("users")
        .update({
          business_name: businessName.trim(),
          partnership_expires_at: new Date(expiresAt).toISOString(),
        })
        .eq("id", existing.used_by)
        .eq("role", "partner");
    }

    return NextResponse.json({ success: true, code: updated });
  } catch (err) {
    console.error("Edit code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/super-admin/codes/[id]
 * Permanently delete a partnership code.
 * If the code was redeemed, the partner's role is revoked first.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminDb, error } = await getAdminDb(req);
    if (error) return error;

    const { id } = await params;

    // Fetch code to check if redeemed
    const { data: existing } = await adminDb!
      .from("partnership_codes")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }

    // Revoke partner access if code was redeemed
    if (existing.used_by) {
      await adminDb!
        .from("users")
        .update({ role: "user", business_name: null, partner_id: null, partnership_expires_at: null })
        .eq("id", existing.used_by)
        .eq("role", "partner");

      // Revoke any staff under this partner
      await adminDb!
        .from("users")
        .update({ role: "user", partner_id: null })
        .eq("partner_id", existing.used_by)
        .eq("role", "staff");

      // Notify the former partner
      await adminDb!.from("notifications").insert({
        user_id: existing.used_by,
        message: `⚠️ Your MoveUp partnership access has been permanently revoked by the administrator.`,
        is_read: false,
        type: "partnership_revoked",
      });
    }

    // Delete the code
    const { error: deleteErr } = await adminDb!
      .from("partnership_codes")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
