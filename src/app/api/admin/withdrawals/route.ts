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

      // Send email notifications to both user and admin if SMTP is configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const { data: userRow } = await adminDb
            .from("users")
            .select("display_name, email")
            .eq("id", requestUser)
            .single();

          if (userRow && userRow.email) {
            const nodemailer = (await import("nodemailer")) as any;
            const transporter = nodemailer.default.createTransport({
              host: smtpHost,
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: { user: smtpUser, pass: smtpPass },
            });

            const recipientName = userRow.display_name || "User";
            const emailHtml = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
                <div style="text-align:center;margin-bottom:20px;">
                  <span style="font-size:40px;">✅</span>
                </div>
                <h2 style="color:#16a34a;text-align:center;margin-top:0;">Withdrawal Completed</h2>
                <p>Hello ${recipientName},</p>
                <p>Your withdrawal request has been reviewed and successfully processed. The funds have been sent to your bank account:</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">Amount:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#16a34a;font-weight:bold;">₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Bank:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.bank_name}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Account Number:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.account_number}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Account Name:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.account_name || "Provided Account"}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Status:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#16a34a;font-weight:bold;">Completed</td>
                  </tr>
                </table>
                <p>If you do not receive the credit in your bank account within 24 hours, please contact support.</p>
                <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
                <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-bottom:0;">MoveUp Platform &copy; ${new Date().getFullYear()}</p>
              </div>
            `;

            // 1. Send to User
            await transporter.sendMail({
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: userRow.email,
              subject: `✅ Withdrawal Completed: ₦${amount.toLocaleString("en-NG")}`,
              html: emailHtml,
            });

            // 2. Send to Admin
            await transporter.sendMail({
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: smtpUser,
              subject: `✅ Withdrawal Completed Notification: ₦${amount.toLocaleString("en-NG")} to ${recipientName}`,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
                  <h2 style="color:#16a34a;text-align:center;margin-top:0;">Withdrawal Processed</h2>
                  <p>Hello Admin,</p>
                  <p>The following withdrawal request has been marked as <strong>Completed</strong> and the user has been notified:</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">User:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;">${recipientName} (${userRow.email})</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Amount:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#16a34a;font-weight:bold;">₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Bank:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.bank_name}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Account Number:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.account_number}</td>
                    </tr>
                  </table>
                  <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
                  <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-bottom:0;">MoveUp Platform &copy; ${new Date().getFullYear()}</p>
                </div>
              `,
            });
          }
        } catch (emailErr) {
          console.error("Failed to send withdrawal completion emails:", emailErr);
        }
      }

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

      // Send email notifications to both user and admin if SMTP is configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const { data: userRow } = await adminDb
            .from("users")
            .select("display_name, email")
            .eq("id", requestUser)
            .single();

          if (userRow && userRow.email) {
            const nodemailer = (await import("nodemailer")) as any;
            const transporter = nodemailer.default.createTransport({
              host: smtpHost,
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: { user: smtpUser, pass: smtpPass },
            });

            const recipientName = userRow.display_name || "User";
            const emailHtml = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
                <div style="text-align:center;margin-bottom:20px;">
                  <span style="font-size:40px;">❌</span>
                </div>
                <h2 style="color:#dc2626;text-align:center;margin-top:0;">Withdrawal Rejected</h2>
                <p>Hello ${recipientName},</p>
                <p>Your withdrawal request has been declined. The full amount has been refunded back to your MoveUp wallet balance:</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">Amount:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#dc2626;font-weight:bold;">₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">Bank Account:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.bank_name} (${requestRow.account_number})</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Status:</td>
                    <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#dc2626;font-weight:bold;">Rejected & Refunded</td>
                  </tr>
                </table>
                <p>Please check your MoveUp dashboard wallet to verify your updated balance. If you have any questions, please contact support.</p>
                <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
                <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-bottom:0;">MoveUp Platform &copy; ${new Date().getFullYear()}</p>
              </div>
            `;

            // 1. Send to User
            await transporter.sendMail({
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: userRow.email,
              subject: `❌ Withdrawal Declined & Refunded: ₦${amount.toLocaleString("en-NG")}`,
              html: emailHtml,
            });

            // 2. Send to Admin
            await transporter.sendMail({
              from: `"MoveUp Platform" <${smtpUser}>`,
              to: smtpUser,
              subject: `❌ Withdrawal Rejected Notification: ₦${amount.toLocaleString("en-NG")} to ${recipientName}`,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
                  <h2 style="color:#dc2626;text-align:center;margin-top:0;">Withdrawal Rejected & Refunded</h2>
                  <p>Hello Admin,</p>
                  <p>The following withdrawal request has been marked as <strong>Rejected</strong> and the funds have been refunded to the user's wallet:</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;width:150px;">User:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;">${recipientName} (${userRow.email})</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Refunded Amount:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;color:#dc2626;font-weight:bold;">₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;font-weight:bold;">Target Bank:</td>
                      <td style="padding:8px;border-bottom:1px solid #eaeaea;">${requestRow.bank_name} (${requestRow.account_number})</td>
                    </tr>
                  </table>
                  <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;" />
                  <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-bottom:0;">MoveUp Platform &copy; ${new Date().getFullYear()}</p>
                </div>
              `,
            });
          }
        } catch (emailErr) {
          console.error("Failed to send withdrawal rejection emails:", emailErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin process withdrawal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
