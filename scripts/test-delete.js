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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const taskId = '8e30f5b1-4abc-49c3-aa5d-a3345d8b218e';
  console.log("Supabase URL:", supabaseUrl);
  console.log("Service Key defined:", !!supabaseServiceKey);
  
  try {
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Supabase returned error:", error);
    } else {
      console.log("Success! Data:", data);
    }
  } catch (err) {
    console.error("Caught exception:", err);
    if (err.cause) {
      console.error("Cause:", err.cause);
    }
  }
}

run();
