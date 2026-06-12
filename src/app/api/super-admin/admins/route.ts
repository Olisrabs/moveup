import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/super-admin/admins
 * Returns a list of all users who are super_admins.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // Auth check
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

    // Verify caller is super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    // Fetch all super_admins
    const { data: admins, error: fetchErr } = await adminDb
      .from("users")
      .select("id, email, display_name, created_at, role")
      .eq("role", "super_admin")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // Determine the primary admin (the oldest super admin)
    const primaryAdminId = admins && admins.length > 0 ? admins[0].id : null;

    const adminsWithFlags = admins.map((admin) => ({
      ...admin,
      isPrimary: admin.id === primaryAdminId,
    }));

    return NextResponse.json({ success: true, admins: adminsWithFlags });
  } catch (err) {
    console.error("Fetch admins error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
