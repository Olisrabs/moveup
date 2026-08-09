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

const completedRoomsData = [
  {
    room_id: 'dee4db71-dfba-41cc-9c88-07c42eb9cd59', // Testing
    members: [
      { user_id: 'b2b8885d-a794-4a06-9524-4bf52b5bbc92', count: 1, name: 'olisrab' }
    ]
  },
  {
    room_id: '9d914489-584e-46fd-a748-a2da20e56946', // Growth Circle
    members: [
      { user_id: 'b2b8885d-a794-4a06-9524-4bf52b5bbc92', count: 10, name: 'olisrab' },
      { user_id: 'e982c6a1-9a43-4b0f-9ea3-99b507b505f8', count: 8, name: 'Emmanuel Beloved' },
      { user_id: '8b285914-1a81-44b3-82a5-dcfab6223de8', count: 6, name: 'Eniolorunda ' },
      { user_id: '6fcf0a29-42b5-433b-b7ae-655c33ff322c', count: 4, name: 'Fashyrg' },
      { user_id: '7c5d3f9e-cc8e-4ddd-a4f4-0193ffee5633', count: 3, name: 'Global Charity' },
      { user_id: '66f04e78-b6cc-4243-9582-0169db0d9841', count: 2, name: 'Aywonder' },
      { user_id: 'cc32ab65-d446-4c60-9cae-e19c41c8489a', count: 1, name: 'Nehena' }
    ]
  }
];

const taskTitles = [
  "Daily meditation and breathing exercises",
  "Read 15 pages of self-development book",
  "Write clean code and commit to GitHub",
  "Learn a new programming concept",
  "Workout session for 30 minutes",
  "French language practice on Duolingo",
  "Review and update the personal portfolio",
  "Post one piece of valuable content online",
  "Reflect on daily goals and successes",
  "Research scholarship opportunities"
];

async function run() {
  console.log("Restoring completed rooms tasks and proofs...");
  for (const room of completedRoomsData) {
    console.log(`Processing room: ${room.room_id}`);
    for (const member of room.members) {
      console.log(`  Adding ${member.count} completed tasks/proofs for ${member.name} (${member.user_id})`);
      for (let i = 0; i < member.count; i++) {
        const title = taskTitles[i % taskTitles.length];
        
        // Insert task
        const { data: task, error: taskErr } = await supabase
          .from("tasks")
          .insert({
            room_id: room.room_id,
            user_id: member.user_id,
            title: title,
            description: "Automatically restored completed task history.",
            status: "completed",
            is_recurring: false,
            last_completed_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (taskErr) {
          console.error("    Error inserting task:", taskErr);
          continue;
        }
        
        // Insert proof
        const { error: proofErr } = await supabase
          .from("proofs")
          .insert({
            task_id: task.id,
            room_id: room.room_id,
            user_id: member.user_id,
            content_type: "image",
            content_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9",
            content_text: "Task completed successfully. Verified proof of work."
          });
          
        if (proofErr) {
          console.error("    Error inserting proof:", proofErr);
        }
      }
    }
  }
  console.log("Completed rooms tasks and proofs restoration finished!");
}

run();
