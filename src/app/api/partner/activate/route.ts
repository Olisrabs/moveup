import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/partner/activate
 * Activates the partner role for the authenticated user by redeeming a partnership code.
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

    // 1. Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { code, businessName } = body;

    if (!code || !businessName) {
      return NextResponse.json({ error: "Code and business name are required" }, { status: 400 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Find the code — must be exact, active, unused, and not expired
    const { data: codeRecord, error: codeErr } = await adminDb
      .from("partnership_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (codeErr || !codeRecord) {
      return NextResponse.json({
        error: "Invalid, expired, or already used partnership code.",
      }, { status: 400 });
    }

    // 3. Check user isn't already a partner/super_admin
    const { data: existingProfile } = await adminDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (existingProfile?.role === "super_admin") {
      return NextResponse.json({ error: "Super admins cannot activate partner codes" }, { status: 400 });
    }

    // 4. Activate partner role on user
    const { error: updateErr } = await adminDb
      .from("users")
      .update({
        role: "partner",
        business_name: businessName.trim(),
        partnership_expires_at: codeRecord.expires_at,
      })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to activate partnership" }, { status: 500 });
    }

    // 5. Mark code as used
    await adminDb
      .from("partnership_codes")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", codeRecord.id);

    // 6. In-app notification
    await adminDb.from("notifications").insert({
      user_id: user.id,
      message: `🎉 Welcome to the MoveUp Partner Program! Your account has been upgraded to Partner status for ${businessName}.`,
      is_read: false,
      type: "partner_activated",
    });

    return NextResponse.json({ success: true, expiresAt: codeRecord.expires_at });
  } catch (err) {
    console.error("Partner activate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
