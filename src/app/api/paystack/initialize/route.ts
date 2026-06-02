import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/paystack/initialize
 * Initializes a Paystack transaction and returns the authorization URL.
 *
 * Body: { amount: number; email: string; userId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { amount, email, userId } = await req.json();

    if (!amount || !email || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    // Determine the base origin dynamically or fallback to localhost
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const callbackUrl = `${origin}/dashboard/wallet`;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // in kobo
        callback_url: callbackUrl,
        metadata: {
          userId,
          amount,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return NextResponse.json({ error: paystackData.message || "Failed to initialize transaction" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    });
  } catch (err) {
    console.error("Paystack initialize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
