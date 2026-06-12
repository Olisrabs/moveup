import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/withdrawals
 * Allows an admin to approve (complete) or reject a manual withdrawal request.
 *
 * Body: {
 *   requestId: string;
 *   action: 'complete' | 'reject';
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { requestId, action } = await req.json();

    if (!requestId || !action || !["complete", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseServiceKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // Get user session to verify they are an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing auth header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // Authenticate the user token using a temporary client configured with the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();

    if (authErr || !user) {
      console.error("Admin auth verification failed:", authErr);
      return NextResponse.json({ error: "Unauthorized user", details: authErr?.message }, { status: 401 });
    }

    // Now instantiate the admin client to check super_admin role and process updates
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // Check super_admin role (also accepts legacy is_admin=true)
    const { data: userProfile, error: profileErr } = await adminDb
      .from("users")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !userProfile || (!userProfile.is_admin && userProfile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden: Super Admin access only" }, { status: 403 });
    }

    // 2. Fetch the withdrawal request
    const { data: requestRow, error: fetchErr } = await adminDb
      .from("withdrawal_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !requestRow) {
      return NextResponse.json({ error: "Withdrawal request not found" }, { status: 404 });
    }

    if (requestRow.status !== "pending") {
      return NextResponse.json({ error: "Request has already been processed" }, { status: 400 });
    }

    const requestUser = requestRow.user_id;
    const amount = Number(requestRow.amount);

    if (action === "complete") {
      // 3. Mark request as completed
      await adminDb
        .from("withdrawal_requests")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", requestId);

      // Update description of the original pending transaction to Completed
      await adminDb
        .from("wallet_transactions")
        .update({
          description: `Withdrawal COMPLETED: ₦${amount.toLocaleString("en-NG")} sent to ${requestRow.bank_name} (${requestRow.account_number})`
        })
        .eq("user_id", requestUser)
        .eq("type", "withdrawal")
        .eq("amount", amount)
        .like("description", "Withdrawal request pending review%");

      // Notify user
      await adminDb.from("notifications").insert({
        user_id: requestUser,
        message: `✅ Withdrawal Completed: ₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been sent to ${requestRow.bank_name} • ${requestRow.account_number}.`,
        is_read: false,
        type: "withdrawal_completed",
      });

    } else if (action === "reject") {
      // 3. Mark request as rejected
      await adminDb
        .from("withdrawal_requests")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", requestId);

      // Fetch user's current balance
      const { data: requestUserRow } = await adminDb
        .from("users")
        .select("balance")
        .eq("id", requestUser)
        .single();

      const currentBalance = Number(requestUserRow?.balance ?? 0);
      const refundedBalance = currentBalance + amount;

      // Update user balance (refund)
      await adminDb
        .from("users")
        .update({ balance: refundedBalance })
        .eq("id", requestUser);

      // Record refund transaction
      await adminDb.from("wallet_transactions").insert({
        user_id: requestUser,
        amount,
        type: "refund",
        description: `Refund for rejected withdrawal: ₦${amount.toLocaleString("en-NG")} to ${requestRow.bank_name} (${requestRow.account_number})`,
      });

      // Notify user
      await adminDb.from("notifications").insert({
        user_id: requestUser,
        message: `❌ Withdrawal Rejected: ₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been refunded to your wallet.`,
        is_read: false,
        type: "withdrawal_rejected",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin process withdrawal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
