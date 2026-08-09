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
  console.log("--- Wallet Transactions ---");
  const { data: txs, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Query error:", error);
    return;
  }
  console.log("Total txs:", txs?.length);
  for (const t of txs || []) {
    console.log(`User ID: ${t.user_id} | Amount: ${t.amount} | Type: ${t.type} | Desc: ${t.description} | Created: ${t.created_at}`);
  }
}

run();
