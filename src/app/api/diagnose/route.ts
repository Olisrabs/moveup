import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch completed rooms
    const { data: rooms, error: roomsErr } = await adminDb
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (roomsErr) {
      return NextResponse.json({ error: "Rooms error: " + roomsErr.message }, { status: 500 });
    }

    const diagnostics = [];

    for (const room of rooms) {
      // Fetch members
      const { data: members, error: membersErr } = await adminDb
        .from("room_members")
        .select("user_id, room_display_name, member_type, fee_waived")
        .eq("room_id", room.id);

      if (membersErr) continue;

      const memberDetails = [];
      for (const m of members) {
        // Fetch tasks
        const { count: pendingCount } = await adminDb
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("user_id", m.user_id)
          .eq("status", "pending");

        // Fetch proofs
        const { count: proofCount } = await adminDb
          .from("proofs")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("user_id", m.user_id);

        // Fetch wallet transactions
        const { data: txs } = await adminDb
          .from("wallet_transactions")
          .select("amount, type, description, created_at")
          .eq("user_id", m.user_id)
          .order("created_at", { ascending: false });

        memberDetails.push({
          user_id: m.user_id,
          display_name: m.room_display_name,
          member_type: m.member_type,
          fee_waived: m.fee_waived,
          pending_tasks: pendingCount ?? 0,
          proofs: proofCount ?? 0,
          wallet_transactions: txs ?? [],
        });
      }

      diagnostics.push({
        room_id: room.id,
        room_name: room.name,
        status: room.status,
        prize_distributed: room.prize_distributed,
        commitment_fee: room.commitment_fee,
        ends_at: room.ends_at,
        members: memberDetails,
      });
    }

    return NextResponse.json({ success: true, diagnostics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
