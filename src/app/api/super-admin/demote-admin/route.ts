import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/super-admin/demote-admin
 * Demotes a super_admin back to a regular user.
 * Prevents demoting oneself or the primary (oldest) super admin.
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
      .select("role, display_name")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 1. Prevent self-demotion
    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot demote yourself. Use the logout or profile actions if needed." }, { status: 400 });
    }

    // Get target user
    const { data: targetUser } = await adminDb
      .from("users")
      .select("id, display_name, email, role")
      .eq("id", userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role !== "super_admin") {
      return NextResponse.json({ error: "User is not a Super Admin" }, { status: 400 });
    }

    // 2. Prevent demoting the primary (oldest) super admin
    const { data: oldestAdmin } = await adminDb
      .from("users")
      .select("id, email, created_at")
      .eq("role", "super_admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (oldestAdmin && targetUser.id === oldestAdmin.id) {
      return NextResponse.json({ error: "This user is the primary Super Admin (Owner) and cannot be demoted or removed." }, { status: 400 });
    }

    // Demote
    const { error: updateErr } = await adminDb
      .from("users")
      .update({ role: "user", is_admin: false })
      .eq("id", targetUser.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send notification
    await adminDb.from("notifications").insert({
      user_id: targetUser.id,
      message: `ℹ️ Your Super Admin access has been revoked by ${callerProfile.display_name ?? "an admin"}. Your role has been changed back to Member.`,
      is_read: false,
      type: "super_admin_demoted",
    });

    return NextResponse.json({ success: true, demotedUser: targetUser.display_name ?? targetUser.email });
  } catch (err) {
    console.error("Demote admin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
