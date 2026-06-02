import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/paystack/banks
 * Returns a list of Nigerian banks from Paystack for the withdrawal form.
 */
export async function GET(_req: NextRequest) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100", {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    const data = await res.json();

    if (!data.status) {
      return NextResponse.json({ error: "Failed to fetch banks" }, { status: 500 });
    }

    return NextResponse.json({ banks: data.data });
  } catch (err) {
    console.error("Paystack banks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
