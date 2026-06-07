
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Same fee calculator as in verify/route.ts
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
 * POST /api/paystack/webhook
 * Receives webhook events from Paystack to ensure wallet funding succeeds 
 * even if the user closes the browser before redirecting to the dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    // Verify webhook signature
    const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    // We only care about successful charges
    if (payload.event === "charge.success") {
      const data = payload.data;
      const reference = data.reference;
      const userId = data.metadata?.userId;
      // Paystack returns amount in kobo — convert to Naira
      const paidAmountNaira = data.amount / 100;

      if (!reference || !userId) {
        console.warn(`[webhook] Missing userId or reference in payload for event ${payload.event}. reference: ${reference}`);
        return NextResponse.json({ success: true, message: "Missing metadata, ignored" });
      }

      // Initialize Supabase admin client
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseServiceKey || !supabaseUrl) {
        console.error("[webhook] Database not configured");
        return NextResponse.json({ error: "Database not configured" }, { status: 500 });
      }

      const adminDb = createClient(supabaseUrl, supabaseServiceKey);

      // ── Idempotency check ──────────────────────────────────────────────────────
      const { data: existingTx } = await adminDb
        .from("wallet_transactions")
        .select("id")
        .ilike("description", `%ref: ${reference}%`)
        .maybeSingle();

      if (existingTx) {
        // Transaction already processed (likely by client-side verification or duplicate webhook)
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // ── Fetch current balance ──────────────────────────────────────────────────
      const { data: userRow, error: fetchErr } = await adminDb
        .from("users")
        .select("balance")
        .eq("id", userId)
        .single();

      if (fetchErr || !userRow) {
        console.error(`[webhook] User not found for id ${userId}`);
        // Return 200 to prevent Paystack from retrying indefinitely for bad data
        return NextResponse.json({ success: true, message: "User not found" });
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
        console.error("[webhook] Failed to update user balance:", updateErr.message);
        return NextResponse.json({ error: `Failed to credit wallet: ${updateErr.message}` }, { status: 500 });
      }

      // ── Record transaction ───────────────────────────────────────────────────
      const txDescription = `Wallet funded: ₦${netAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} (Paid ₦${paidAmountNaira.toLocaleString("en-NG")} minus ₦${paystackFee} Paystack fee & ₦${moveupFee} MoveUp fee) — ref: ${reference}`;
      const { error: txErr } = await adminDb.from("wallet_transactions").insert({
        user_id: userId,
        amount: netAmount,
        type: "fund",
        description: txDescription,
      });

      if (txErr) {
        console.error(`[webhook] wallet_transactions insert failed for ref ${reference}:`, txErr.message);
      }

      // ── Send in-app notification ───────────────────────────────────────────────
      await adminDb.from("notifications").insert({
        user_id: userId,
        message: `💰 Wallet Credited: ₦${netAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}. (Deposit: ₦${paidAmountNaira.toLocaleString("en-NG")}, Paystack Fee: ₦${paystackFee}, MoveUp Fee: ₦${moveupFee}). New balance: ₦${newBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}.`,
        is_read: false,
        type: "wallet_fund",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Paystack webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}