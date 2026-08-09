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
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Starting DB tasks cleanup...");
  
  try {
    // 1. Fetch completed or prize_distributed rooms
    const { data: completedRooms, error: roomsErr } = await supabase
      .from("rooms")
      .select("id, name, status, prize_distributed")
      .or("status.eq.completed,prize_distributed.eq.true");

    if (roomsErr) {
      console.error("Error fetching completed rooms:", roomsErr);
      return;
    }
    
    console.log(`Found ${completedRooms.length} completed/finalized rooms.`);
    
    if (completedRooms.length > 0) {
      const roomIds = completedRooms.map(r => r.id);
      
      // Fetch tasks for completed rooms
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("id, title, room_id")
        .in("room_id", roomIds);
        
      if (tasksErr) {
        console.error("Error fetching tasks for completed rooms:", tasksErr);
        return;
      }
      
      console.log(`Found ${tasks.length} tasks belonging to completed rooms.`);
      
      if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        
        // Delete proofs first
        const { error: proofsDeleteErr } = await supabase
          .from("proofs")
          .delete()
          .in("task_id", taskIds);
          
        if (proofsDeleteErr) {
          console.error("Error deleting proofs:", proofsDeleteErr);
        } else {
          console.log("Successfully deleted associated proofs.");
        }
        
        // Delete tasks
        const { error: tasksDeleteErr } = await supabase
          .from("tasks")
          .delete()
          .in("id", taskIds);
          
        if (tasksDeleteErr) {
          console.error("Error deleting tasks:", tasksDeleteErr);
        } else {
          console.log(`Successfully deleted ${taskIds.length} tasks from completed rooms.`);
        }
      }
    }

    // 2. Fetch all tasks and rooms to check for orphaned tasks (linked to non-existent rooms)
    const { data: allTasks, error: allTasksErr } = await supabase
      .from("tasks")
      .select("id, room_id");
      
    const { data: allRooms, error: allRoomsErr } = await supabase
      .from("rooms")
      .select("id");
      
    if (allTasksErr) {
      console.error("Error fetching all tasks:", allTasksErr);
    } else if (allRoomsErr) {
      console.error("Error fetching all rooms:", allRoomsErr);
    } else {
      const roomSet = new Set(allRooms.map(r => r.id));
      const orphanedTasks = allTasks.filter(t => !t.room_id || !roomSet.has(t.room_id));
      
      console.log(`Found ${orphanedTasks.length} orphaned tasks without a valid room.`);
      if (orphanedTasks.length > 0) {
        const orphanIds = orphanedTasks.map(t => t.id);
        
        // Delete proofs
        await supabase.from("proofs").delete().in("task_id", orphanIds);
        // Delete tasks
        const { error: orphanDelErr } = await supabase.from("tasks").delete().in("id", orphanIds);
        if (orphanDelErr) {
          console.error("Error deleting orphaned tasks:", orphanDelErr);
        } else {
          console.log(`Deleted ${orphanIds.length} orphaned tasks successfully.`);
        }
      }
    }
    
    console.log("Database tasks cleanup completed successfully!");
  } catch (err) {
    console.error("Caught exception:", err);
  }
}

run();
