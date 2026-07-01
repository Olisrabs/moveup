const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read env variables manually from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found in project root.");
  process.exit(1);
}

const dotenvContent = fs.readFileSync(envPath, 'utf8');
const env = {};
dotenvContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local.");
  process.exit(1);
}

console.log("Connecting to Supabase URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Fetching rooms with prize_distributed = true...");
  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("prize_distributed", true);

  if (roomsErr) {
    console.error("Error fetching rooms:", roomsErr.message);
    return;
  }

  if (!rooms || rooms.length === 0) {
    console.log("No rooms found with prize_distributed = true.");
    return;
  }

  for (const room of rooms) {
    console.log(`\nProcessing Room: "${room.name}" (ID: ${room.id}, Fee: ₦${room.commitment_fee})`);

    // Fetch members
    const { data: members, error: membersErr } = await supabase
      .from("room_members")
      .select("user_id, room_display_name, member_type, fee_waived")
      .eq("room_id", room.id);

    if (membersErr || !members) {
      console.error(`Error fetching members for room ${room.id}:`, membersErr?.message);
      continue;
    }

    console.log(`  - Total members: ${members.length}`);

    // Build leaderboard entries
    const entries = [];
    for (const m of members) {
      const [{ count: pendingCount }, { count: proofCount }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("room_id", room.id).eq("user_id", m.user_id).eq("status", "pending"),
        supabase.from("proofs").select("*", { count: "exact", head: true }).eq("room_id", room.id).eq("user_id", m.user_id),
      ]);

      const done = proofCount ?? 0;
      const total = done + (pendingCount ?? 0);
      entries.push({
        user_id: m.user_id,
        display_name: m.room_display_name,
        member_type: m.member_type,
        fee_waived: m.fee_waived,
        done,
        total,
        pct: total > 0 ? done / total : 0,
      });
    }

    // Sort to determine leaderboard ranking
    entries.sort((a, b) => b.pct - a.pct || b.done - a.done);

    // Calculate total pool based on all members (matching original frontend logic)
    const totalPool = Number(room.commitment_fee) * members.length;
    console.log(`  - Total Pool: ₦${totalPool.toLocaleString()}`);

    const prizeTypes = ['prize_1st', 'prize_2nd', 'prize_3rd'];
    const prizeLabels = ['1st place', '2nd place', '3rd place'];
    const splits = members.length < 4 ? [1, 0, 0] : [0.5, 0.3, 0.2];

    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const pct = splits[i];
      if (pct === 0) continue;

      const prize = totalPool * pct;
      const winner = entries[i];
      console.log(`  - Ranked #${i + 1}: ${winner.display_name} (User ID: ${winner.user_id}, Done: ${winner.done}/${winner.total}, Pct: ${(winner.pct * 100).toFixed(2)}%)`);

      // Fetch user's current profile balance
      const { data: ub, error: balanceErr } = await supabase
        .from("users")
        .select("balance")
        .eq("id", winner.user_id)
        .single();

      if (balanceErr || !ub) {
        console.error(`    Error fetching user balance:`, balanceErr?.message);
        continue;
      }

      const currentBalance = Number(ub.balance ?? 0);

      // Check if transaction already exists for this winner in this room
      const { data: existingTx, error: txCheckErr } = await supabase
        .from("wallet_transactions")
        .select("id, amount")
        .eq("user_id", winner.user_id)
        .eq("type", prizeTypes[i])
        .like("description", `%${room.name}%`);

      if (txCheckErr) {
        console.error(`    Error checking transaction for ${winner.display_name}:`, txCheckErr.message);
        continue;
      }

      if (existingTx && existingTx.length > 0) {
        console.log(`    -> Transaction row exists in database.`);

        // Reconcile by comparing actual profile balance with expected ledger total
        const { data: allTxs, error: allTxsErr } = await supabase
          .from("wallet_transactions")
          .select("amount, type")
          .eq("user_id", winner.user_id);

        if (allTxsErr || !allTxs) {
          console.error(`    Error fetching all transactions for user:`, allTxsErr?.message);
          continue;
        }

        let expectedBalance = 0;
        for (const tx of allTxs) {
          const amt = Number(tx.amount);
          if (['deposit', 'prize_1st', 'prize_2nd', 'prize_3rd', 'referral_bonus'].includes(tx.type)) {
            expectedBalance += amt;
          } else if (['withdrawal', 'commitment_fee', 'payout'].includes(tx.type)) {
            expectedBalance -= amt;
          }
        }

        const difference = expectedBalance - currentBalance;
        if (difference > 0.01) {
          console.log(`    -> WARNING: Balance discrepancy detected!`);
          console.log(`       - Expected (from transactions): ₦${expectedBalance.toLocaleString()}`);
          console.log(`       - Actual (in user profile):      ₦${currentBalance.toLocaleString()}`);
          console.log(`       - Discrepancy (Missing Funds):   ₦${difference.toLocaleString()}`);
          console.log(`    -> Reconciling balance...`);

          const { error: updateErr } = await supabase
            .from("users")
            .update({ balance: expectedBalance })
            .eq("id", winner.user_id);

          if (updateErr) {
            console.error(`       Error updating user balance:`, updateErr.message);
          } else {
            console.log(`       Successfully reconciled balance! New balance is ₦${expectedBalance.toLocaleString()}`);
          }
        } else {
          console.log(`    -> Balance is correct. Expected: ₦${expectedBalance.toLocaleString()}, Actual: ₦${currentBalance.toLocaleString()}`);
        }
        continue;
      }

      console.log(`    -> Distributing missing ${prizeLabels[i]} prize (₦${prize.toLocaleString()}) to ${winner.display_name}...`);
      const newBal = currentBalance + prize;

      // Update user's balance
      const { error: updateErr } = await supabase
        .from("users")
        .update({ balance: newBal })
        .eq("id", winner.user_id);

      if (updateErr) {
        console.error(`    Error updating user balance:`, updateErr.message);
        continue;
      }

      // Record transaction
      const description = `${prizeLabels[i]} prize from room "${room.name}" — ₦${Number(prize).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const { error: insertTxErr } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: winner.user_id,
          amount: prize,
          type: prizeTypes[i],
          description,
        });

      if (insertTxErr) {
        console.error(`    Error inserting transaction record:`, insertTxErr.message);
      } else {
        console.log(`    -> Wallet updated. Balance: ₦${currentBalance} -> ₦${newBal}`);
      }
    }
  }

  console.log("\nDone!");
}

run();
