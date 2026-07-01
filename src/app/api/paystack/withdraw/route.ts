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
      .select("balance, display_name, email")
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

    // 5. Notify user in-app
    await adminDb.from("notifications").insert({
      user_id: userId,
      message: `⏳ Withdrawal of ₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been requested. Status: Pending Review (24 Hours expected).`,
      is_read: false,
      type: "withdrawal_pending",
    });

    // 6. Send email notification to Admin if SMTP configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = (await import("nodemailer")) as any;
        const transporter = nodemailer.default.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        });

        const requesterName = userRow.display_name || "A user";
        const requesterEmail = userRow.email || "No email provided";

        await transporter.sendMail({
          from: `"MoveUp Platform" <${smtpUser}>`,
          to: smtpUser,
          subject: `💸 New Withdrawal Request: ₦${amount.toLocaleString("en-NG")} by ${requesterName}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
              <h2 style="color:#2563eb;text-align:center;margin-top:0;">New Withdrawal Request</h2>
              <p>Hello Admin,</p>
              <p>A new manual withdrawal request has been submitted and is pending review:</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">User:</td>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requesterName} (${requesterEmail})</td>
                </tr>
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Amount:</td>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#2563eb;font-weight:bold;">₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Bank:</td>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;">${bankName}</td>
                </tr>
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Account Number:</td>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;">${accountNumber}</td>
                </tr>
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Account Name:</td>
                  <td style="padding:8px;border-bottom:1px solid #eaeaea;">${accountName}</td>
                </tr>
              </table>
              <p>You can process this request by logging into the Admin Dashboard.</p>
              <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
              <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-bottom:0;">MoveUp Platform &copy; ${new Date().getFullYear()}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send admin withdrawal request email:", emailErr);
      }
    }

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
