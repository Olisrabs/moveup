const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found.");
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("--- Active Room Tasks & Proofs ---");
  // Active rooms
  const { data: rooms } = await supabase.from("rooms").select("*").eq("status", "active");
  for (const r of rooms) {
    console.log(`\nRoom: ${r.name} (${r.id})`);
    
    // Tasks
    const { data: tasks } = await supabase.from("tasks").select("*").eq("room_id", r.id);
    console.log(`Tasks (${tasks?.length || 0}):`);
    for (const t of tasks) {
      console.log(`  Task: "${t.title}" | Status: ${t.status} | Recur: ${t.is_recurring} | User: ${t.user_id}`);
    }
    
    // Proofs
    const { data: proofs } = await supabase.from("proofs").select("*").eq("room_id", r.id);
    console.log(`Proofs (${proofs?.length || 0}):`);
    for (const p of proofs) {
      console.log(`  Proof: Task ID: ${p.task_id} | User: ${p.user_id} | Type: ${p.content_type}`);
    }
  }
}

run();
