const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read env variables manually from .env.local
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("--- Supabase Diagnostics ---");
  
  // 1. Fetch some tasks from completed rooms to see what's going on
  console.log("\nFetching tasks that belong to completed/prize_distributed rooms...");
  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("id, name, status, prize_distributed")
    .or("status.eq.completed,prize_distributed.eq.true");

  if (roomsErr) {
    console.error("Error fetching completed rooms:", roomsErr.message);
    return;
  }

  console.log(`Found ${rooms.length} completed/prize-distributed rooms.`);
  const completedRoomIds = rooms.map(r => r.id);

  if (completedRoomIds.length > 0) {
    const { data: tasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, title, room_id, user_id, is_recurring, status")
      .in("room_id", completedRoomIds);

    if (tasksErr) {
      console.error("Error fetching tasks for completed rooms:", tasksErr.message);
    } else {
      console.log(`Found ${tasks.length} tasks in completed rooms:`);
      tasks.forEach(t => {
        const room = rooms.find(r => r.id === t.room_id);
        console.log(`  - Task ID: ${t.id} | Title: "${t.title}" | Status: ${t.status} | Recurring: ${t.is_recurring} | Room: "${room.name}" (${room.status})`);
      });
    }
  }

  // 2. Fetch delete policies from pg_policies
  console.log("\nFetching RLS policies for public.tasks and public.proofs tables...");
  const { data: policies, error: policiesErr } = await supabase
    .rpc("pg_policies_query"); // Wait, does this RPC exist? Let's check or handle error

  if (policiesErr) {
    console.log("Could not query policies via RPC (standard behavior if pg_policies_query RPC doesn't exist).");
    console.log("Let's try to query public.tasks RLS directly by checking what policies might be active or if we can query pg_policies via a dynamic query.");
  } else {
    console.log("Policies:", policies);
  }

  console.log("\nDiagnostics finished.");
}

run();
