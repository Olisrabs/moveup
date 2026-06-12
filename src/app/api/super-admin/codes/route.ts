import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/super-admin/codes
 * Returns all partnership codes with usage info.
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
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch codes with joined user info
    const { data: codes, error } = await adminDb
      .from("partnership_codes")
      .select(`
        *,
        used_by_user:used_by(display_name, email)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch codes" }, { status: 500 });
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (err) {
    console.error("Fetch codes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
