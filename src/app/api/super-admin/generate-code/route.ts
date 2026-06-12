import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * POST /api/super-admin/generate-code
 * Super admin generates a new partnership code with a specific duration.
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
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      console.error("[Generate Code Auth Error] Token validation failed:", authErr);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify super_admin
    const { data: callerProfile } = await adminDb
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    const body = await req.json();
    const { businessName, durationDays } = body;

    if (!businessName || !durationDays || durationDays < 1) {
      return NextResponse.json({ error: "businessName and durationDays (>0) are required" }, { status: 400 });
    }

    // 3. Generate a unique readable code: MUP-XXXX-XXXX-XXXX
    const generateCode = (): string => {
      const part = () => randomBytes(2).toString("hex").toUpperCase();
      return `MUP-${part()}-${part()}-${part()}`;
    };

    // Ensure uniqueness
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await adminDb
        .from("partnership_codes")
        .select("id")
        .eq("code", code)
        .single();
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    // 4. Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(durationDays));

    // 5. Insert
    const { data: codeRecord, error: insertErr } = await adminDb
      .from("partnership_codes")
      .insert({
        code,
        created_by: user.id,
        business_name: businessName.trim(),
        duration_days: Number(durationDays),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (insertErr || !codeRecord) {
      return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
    }

    return NextResponse.json({ success: true, code: codeRecord });
  } catch (err) {
    console.error("Generate code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
