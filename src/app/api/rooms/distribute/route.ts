import { NextRequest, NextResponse } from "next/server";
import { formatNaira } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseServiceKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");

    // 1. Authenticate sender using their Bearer JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing auth header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized user" }, { status: 401 });
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch the room
    const { data: room, error: roomErr } = await adminDb
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // 3. Verify authorization: Room creator or admin
    const { data: userProfile } = await adminDb
      .from("users")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    const isAuthorized = room.created_by === user.id || userProfile?.role === "super_admin" || userProfile?.is_admin === true;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to distribute prizes for this room" }, { status: 403 });
    }

    // 4. Verify room has expired
    const isExpired = new Date(room.ends_at).getTime() < Date.now();
    if (!isExpired) {
      return NextResponse.json({ error: "Room has not expired yet" }, { status: 400 });
    }

    // 5. Verify prizes not already distributed
    if (room.prize_distributed) {
      return NextResponse.json({ error: "Prizes have already been distributed for this room" }, { status: 400 });
    }

    // 6. Fetch room members (including join with users to get display name)
    const { data: members, error: membersErr } = await adminDb
      .from("room_members")
      .select("user_id, room_display_name, member_type, fee_waived, users(display_name)")
      .eq("room_id", roomId);

    if (membersErr || !members || members.length === 0) {
      return NextResponse.json({ error: "No members found in this room" }, { status: 400 });
    }

    // 7. Calculate leaderboard entries (exclude observers or check tasks/proofs for all members)
    const entries = await Promise.all(
      members.map(async (m) => {
        const [{ count: pendingCount }, { count: proofCount }] = await Promise.all([
          adminDb.from("tasks").select("*", { count: "exact", head: true }).eq("room_id", roomId).eq("user_id", m.user_id).eq("status", "pending"),
          adminDb.from("proofs").select("*", { count: "exact", head: true }).eq("room_id", roomId).eq("user_id", m.user_id),
        ]);
        const done = proofCount ?? 0;
        const total = done + (pendingCount ?? 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ud = m.users as any;
        return {
          user_id: m.user_id,
          display_name: ud?.display_name || m.room_display_name || "Unknown",
          total,
          done,
          pct: total > 0 ? done / total : 0,
          member_type: m.member_type,
          fee_waived: m.fee_waived,
        };
      })
    );

    // Only actual participants (non-observers) can win prizes and count towards the pool
    const participants = entries.filter((e) => e.member_type === "participant");

    if (participants.length === 0) {
      return NextResponse.json({ error: "No competing participants found in this room" }, { status: 400 });
    }

    // Sort participants: highest percentage first, then highest number of completed tasks
    participants.sort((a, b) => b.pct - a.pct || b.done - a.done);

    // Pool calculation is based on paying participants
    const payingParticipants = participants.filter((p) => !p.fee_waived);
    const totalPool = Number(room.commitment_fee) * payingParticipants.length;

    const prizeTypes: Array<"prize_1st" | "prize_2nd" | "prize_3rd"> = ["prize_1st", "prize_2nd", "prize_3rd"];
    const prizeLabels = ["1st place", "2nd place", "3rd place"];

    // Split rules:
    // If fewer than 4 total participants, 1st place gets 100% of the pool.
    // Otherwise: 1st place gets 50%, 2nd gets 30%, 3rd gets 20%.
    const splits = participants.length < 4 ? [1, 0, 0] : [0.5, 0.3, 0.2];
    const notifications: { user_id: string; message: string; is_read: boolean; type: string; room_id: string }[] = [];

    // Distribute prizes to the top winners (up to 3)
    for (let i = 0; i < Math.min(participants.length, 3); i++) {
      const pct = splits[i];
      if (pct === 0) continue;
      
      const prize = totalPool * pct;
      const winnerId = participants[i].user_id;

      // Fetch user's current balance
      const { data: ub, error: balanceErr } = await adminDb
        .from("users")
        .select("balance")
        .eq("id", winnerId)
        .single();

      if (balanceErr || !ub) {
        console.error(`Error fetching balance for user ${winnerId}:`, balanceErr);
        continue; // Skip this user to avoid crashing, though in prod we hope this doesn't happen
      }

      const currentBalance = Number(ub.balance ?? 0);
      const newBal = currentBalance + prize;

      // Update user's balance
      const { error: updateErr } = await adminDb
        .from("users")
        .update({ balance: newBal })
        .eq("id", winnerId);

      if (updateErr) {
        console.error(`Error updating balance for user ${winnerId}:`, updateErr);
        continue;
      }

      // Record transaction
      const { error: txErr } = await adminDb
        .from("wallet_transactions")
        .insert({
          user_id: winnerId,
          amount: prize,
          type: prizeTypes[i],
          description: `${prizeLabels[i]} prize from room "${room.name}" — ${formatNaira(prize)}`,
        });

      if (txErr) {
        console.error(`Error inserting wallet transaction for user ${winnerId}:`, txErr);
      }

      // Add notification for the winner
      notifications.push({
        user_id: winnerId,
        room_id: room.id,
        message: `🏆 You finished ${prizeLabels[i]} in "${room.name}"! ${formatNaira(prize)} has been credited to your wallet.`,
        is_read: false,
        type: "prize_credit",
      });
    }

    // Add notification for other members (non-winners or observers)
    const winnerIds = participants.slice(0, 3).map((p) => p.user_id);
    for (const m of members) {
      if (!winnerIds.includes(m.user_id)) {
        notifications.push({
          user_id: m.user_id,
          room_id: room.id,
          message: `🏁 The room "${room.name}" has ended. Prizes have been distributed to the top performers.`,
          is_read: false,
          type: "room_ended",
        });
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: notifErr } = await adminDb.from("notifications").insert(notifications);
      if (notifErr) {
        console.error("Error inserting notifications:", notifErr);
      }
    }

    // 8. Update room to completed status and mark prizes as distributed
    const { error: roomUpdateErr } = await adminDb
      .from("rooms")
      .update({ prize_distributed: true, status: "completed" })
      .eq("id", room.id);

    if (roomUpdateErr) {
      console.error("Error updating room status:", roomUpdateErr);
      return NextResponse.json({ error: "Failed to mark room as completed" }, { status: 500 });
    }

    // 9. Disable recurring flag on all tasks in this room so they can never
    //    be auto-reset by the daily lazy-reset logic after the room ends.
    const { error: recurringClearErr } = await adminDb
      .from("tasks")
      .update({ is_recurring: false })
      .eq("room_id", room.id)
      .eq("is_recurring", true);

    if (recurringClearErr) {
      // Non-fatal: log but don't block the response — room is already marked complete.
      console.error("Error clearing recurring flag on tasks:", recurringClearErr);
    }

    return NextResponse.json({
      success: true,
      message: "Prizes distributed successfully",
    });

  } catch (err: any) {
    console.error("Error in prize distribution API:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
