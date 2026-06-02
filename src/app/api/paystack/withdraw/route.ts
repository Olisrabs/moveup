import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/paystack/withdraw
 * Submits a manual withdrawal request and deducts the user's balance immediately (escrow).
 *
 * Body: {
 *   userId: string;
 *   amount: number;          // Naira
 *   bankName: string;
 *   accountNumber: string;
 *   accountName: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, amount, bankName, accountNumber, accountName } = await req.json();

    if (!userId || !amount || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (amount < 500) {
      return NextResponse.json({ error: "Minimum withdrawal amount is ₦500" }, { status: 400 });
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify user has sufficient balance
    const { data: userRow, error: fetchErr } = await adminDb
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (fetchErr || !userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentBalance = Number(userRow.balance);
    if (currentBalance < amount) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    // 2. Deduct from wallet balance (escrow)
    const newBalance = currentBalance - amount;
    const { error: updateErr } = await adminDb
      .from("users")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update wallet balance" }, { status: 500 });
    }

    // 3. Create a withdrawal request record
    const { data: requestRow, error: insertErr } = await adminDb
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr || !requestRow) {
      // Refund if insertion failed
      await adminDb.from("users").update({ balance: currentBalance }).eq("id", userId);
      return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 });
    }

    // 4. Record wallet transaction
    await adminDb.from("wallet_transactions").insert({
      user_id: userId,
      amount,
      type: "withdrawal",
      description: `Withdrawal request pending review: ₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} to ${bankName} (${accountNumber})`,
    });

    // 5. Notify user
    await adminDb.from("notifications").insert({
      user_id: userId,
      message: `⏳ Withdrawal of ₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been requested. Status: Pending Review (24 Hours expected).`,
      is_read: false,
      type: "withdrawal_pending",
    });

    return NextResponse.json({
      success: true,
      requestId: requestRow.id,
      newBalance,
    });
  } catch (err) {
    console.error("Manual withdraw request error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
