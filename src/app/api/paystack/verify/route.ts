import { NextRequest, NextResponse } from "next/server";

// Dynamic fee calculator based on official Paystack schedule (1.5% + NGN 100, waived under NGN 2,500, capped at NGN 2,000)
// and MoveUp fee of 1%
function calculateFees(amount: number) {
  if (amount <= 0) return { paystackFee: 0, moveupFee: 0, netAmount: 0 };
  const paystackFee = amount < 2500 ? (amount * 0.015) : (amount * 0.015 + 100);
  const finalPaystackFee = Math.min(2000, paystackFee);
  const moveupFee = amount * 0.01;
  const netAmount = amount - finalPaystackFee - moveupFee;
  return {
    paystackFee: Math.round(finalPaystackFee * 100) / 100,
    moveupFee: Math.round(moveupFee * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100
  };
}

/**
 * POST /api/paystack/verify
 * Verifies a Paystack payment and credits the user's wallet with the net amount after fees.
 *
 * Body: { reference: string; userId: string; expectedAmount: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { reference, userId, expectedAmount } = await req.json();

    if (!reference || !userId) {
      return NextResponse.json({ error: "Missing reference or userId" }, { status: 400 });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    // Verify with Paystack
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== "success") {
      return NextResponse.json({ error: "Payment verification failed", details: paystackData }, { status: 400 });
    }

    // Paystack returns amount in kobo — convert to Naira
    const paidAmountNaira = paystackData.data.amount / 100;

    // Guard: paid amount must match expected (allow small rounding diff).
    // Only enforced when expectedAmount is explicitly provided and > 0.
    if (expectedAmount && expectedAmount > 0 && Math.abs(paidAmountNaira - expectedAmount) > 1) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    // Credit wallet via Supabase service role key
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // ── Idempotency check ──────────────────────────────────────────────────────
    // If this Paystack reference was already processed, return success without
    // crediting again. This prevents double-crediting on page refresh or
    // duplicate Paystack callbacks.
    const { data: existingTx } = await adminDb
      .from("wallet_transactions")
      .select("id")
      .ilike("description", `%ref: ${reference}%`)
      .maybeSingle();

    if (existingTx) {
      // Already processed — return success but don't credit again
      const { data: userRowFresh } = await adminDb
        .from("users").select("balance").eq("id", userId).single();
      return NextResponse.json({
        success: true,
        newBalance: Number(userRowFresh?.balance ?? 0),
        amountCredited: 0,
        alreadyProcessed: true,
      });
    }

    // ── Fetch current balance ──────────────────────────────────────────────────
    const { data: userRow, error: fetchErr } = await adminDb
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (fetchErr || !userRow) {
      return NextResponse.json({ error: "User not found — userId may not match any users table row" }, { status: 404 });
    }

    // Calculate Fees
    const { paystackFee, moveupFee, netAmount } = calculateFees(paidAmountNaira);
    const newBalance = Number(userRow.balance) + netAmount;

    // ── Update balance ─────────────────────────────────────────────────────────
    const { error: updateErr } = await adminDb
      .from("users")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateErr) {
      return NextResponse.json({ error: `Failed to credit wallet: ${updateErr.message}` }, { status: 500 });
    }

    // ── Record transaction (surfaced error) ────────────────────────────────────
    const txDescription = `Wallet funded: ₦${netAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} (Paid ₦${paidAmountNaira.toLocaleString("en-NG")} minus ₦${paystackFee} Paystack fee & ₦${moveupFee} MoveUp fee) — ref: ${reference}`;
    const { error: txErr } = await adminDb.from("wallet_transactions").insert({
      user_id: userId,
      amount: netAmount,
      type: "fund",
      description: txDescription,
    });

    if (txErr) {
      // Balance was credited but transaction log failed — log it so it can be
      // manually reconciled. Do NOT return an error to the client since the
      // user's money has already been credited correctly.
      console.error(`[verify] wallet_transactions insert failed for ref ${reference}:`, txErr.message);
    }

    // ── Send in-app notification ───────────────────────────────────────────────
    await adminDb.from("notifications").insert({
      user_id: userId,
      message: `💰 Wallet Credited: ₦${netAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}. (Deposit: ₦${paidAmountNaira.toLocaleString("en-NG")}, Paystack Fee: ₦${paystackFee}, MoveUp Fee: ₦${moveupFee}). New balance: ₦${newBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}.`,
      is_read: false,
      type: "wallet_fund",
    });

    return NextResponse.json({ success: true, newBalance, amountCredited: netAmount });
  } catch (err) {
    console.error("Paystack verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
