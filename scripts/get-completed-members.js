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
  const completedRoomIds = [
    'dee4db71-dfba-41cc-9c88-07c42eb9cd59', // Testing
    '9d914489-584e-46fd-a748-a2da20e56946'  // Growth Circle
  ];

  for (const rid of completedRoomIds) {
    console.log(`\nRoom ID: ${rid}`);
    const { data: members } = await supabase.from("room_members").select("*").eq("room_id", rid);
    for (const m of members) {
      console.log(`  Member UserID: ${m.user_id} | Name: ${m.room_display_name}`);
    }
  }
}

run();
