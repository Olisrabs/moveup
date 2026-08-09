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
  console.log("--- Rooms Info ---");
  const { data: rooms } = await supabase.from("rooms").select("*");
  console.log("Total Rooms:", rooms.length);
  for (const r of rooms) {
    console.log(`Room: ${r.name} (${r.id}) | Code: ${r.code} | Status: ${r.status} | Prize Dist: ${r.prize_distributed} | Ends At: ${r.ends_at}`);
    const { data: members } = await supabase.from("room_members").select("*").eq("room_id", r.id);
    console.log(`  Members (${members?.length || 0}):`, members?.map(m => m.room_display_name).join(", "));
    const { count: taskCount } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("room_id", r.id);
    const { count: proofCount } = await supabase.from("proofs").select("*", { count: "exact", head: true }).eq("room_id", r.id);
    console.log(`  Tasks count: ${taskCount || 0} | Proofs count: ${proofCount || 0}`);
  }
}

run();
