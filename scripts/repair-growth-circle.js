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
  console.log("Restoring correct wallet balances for 'Growth Circle' winners...");

  // 1. Emmanuel Beloved
  // Original Balance: 0.18, Prize: 1050, Target: 1050.18
  const emmanuelId = 'e982c6a1-9a43-4b0f-9ea3-99b507b505f8';
  console.log(`Updating Emmanuel Beloved (ID: ${emmanuelId}) balance to ₦1,050.18...`);
  const { error: err1 } = await supabase
    .from("users")
    .update({ balance: 1050.18 })
    .eq("id", emmanuelId);

  if (err1) {
    console.error("Error updating Emmanuel Beloved:", err1.message);
  } else {
    console.log("Successfully updated Emmanuel Beloved's balance.");
  }

  // 2. Eniolorunda
  // Original Balance: 85, Prize: 700, Target: 785
  const eniolorundaId = '8b285914-1a81-44b3-82a5-dcfab6223de8';
  console.log(`Updating Eniolorunda (ID: ${eniolorundaId}) balance to ₦785.00...`);
  const { error: err2 } = await supabase
    .from("users")
    .update({ balance: 785.00 })
    .eq("id", eniolorundaId);

  if (err2) {
    console.error("Error updating Eniolorunda:", err2.message);
  } else {
    console.log("Successfully updated Eniolorunda's balance.");
  }

  console.log("\nReconciliation complete!");
}

run();
