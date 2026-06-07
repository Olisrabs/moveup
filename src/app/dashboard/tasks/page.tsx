"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare, Clock, Plus, Check, X, Loader2,
  Upload, Link as LinkIcon, FileText, ImageIcon, Shield, Pencil, Lock, Repeat, RefreshCw,
} from "lucide-react";

/** Returns true if the task was created less than 30 minutes ago. */
const isTaskEditable = (task: { created_at: string }): boolean => {
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  return Date.now() - new Date(task.created_at).getTime() < THIRTY_MINUTES_MS;
};

/** How many minutes remain in the edit window (clamped to 0). */
const editMinutesLeft = (task: { created_at: string }): number => {
  const elapsed = Date.now() - new Date(task.created_at).getTime();
  return Math.max(0, Math.ceil((30 * 60 * 1000 - elapsed) / 60_000));
};
import { useAuth } from "@/lib/auth-context";
import { supabase, type Task, type Room } from "@/lib/supabase";

const today = new Date().toISOString().split("T")[0];

export default function TasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", room_id: "", due_date: "", is_recurring: false });

  // Edit task
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", due_date: "" });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editExpiredToast, setEditExpiredToast] = useState(false);

  // Proof modal
  const [proofTask, setProofTask] = useState<Task | null>(null);
  const [proofType, setProofType] = useState<"text" | "link" | "image">("text");
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofExplanation, setProofExplanation] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: taskData }, { data: memberRooms }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];
    const processedTasks = (taskData ?? []).map(t => {
      if (t.is_recurring && t.status === "completed") {
        const completedDate = t.last_completed_at ? t.last_completed_at.split("T")[0] : null;
        if (completedDate !== todayStr) {
          supabase.from("tasks").update({ status: "pending" }).eq("id", t.id).then();
          return { ...t, status: "pending" as const };
        }
      }
      return t;
    });

    setTasks(processedTasks);
    const roomIds = (memberRooms ?? []).map((m) => m.room_id);
    if (roomIds.length > 0) {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, name, code, description, duration_days, commitment_fee, max_members, created_by, status, created_at, ends_at, prize_distributed")
        .in("id", roomIds).eq("status", "active");
      setRooms(roomData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [user]);

  const showExpiredToast = () => {
    setEditExpiredToast(true);
    setTimeout(() => setEditExpiredToast(false), 3500);
  };

  const openEditModal = (task: Task) => {
    if (!isTaskEditable(task)) {
      showExpiredToast();
      return;
    }
    setEditTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    // Double-check the 30-minute window at submission time (guards against
    // a tab being left open past the deadline).
    if (!isTaskEditable(editTask)) {
      setEditError("The 30-minute edit window for this task has expired.");
      setEditing(false);
      return;
    }
    setEditing(true); setEditError(null);
    const { error } = await supabase.from("tasks").update({
      title: editForm.title,
      description: editForm.description || null,
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
    }).eq("id", editTask.id);
    if (error) { setEditError(error.message); setEditing(false); return; }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editTask.id
          ? { ...t, title: editForm.title, description: editForm.description || null, due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null }
          : t
      )
    );
    setEditTask(null); setEditing(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAdding(true); setAddError(null);
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description || null,
      room_id: form.room_id, user_id: user.id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      is_recurring: form.is_recurring,
    });
    if (error) { setAddError(error.message); setAdding(false); return; }
    setShowAdd(false);
    setForm({ title: "", description: "", room_id: "", due_date: "", is_recurring: false });
    fetchData(); setAdding(false);
  };

  const openProofModal = (task: Task) => {
    if (task.status === "completed") return;
    setProofTask(task); setProofType("text");
    setProofText(""); setProofLink(""); setProofFile(null);
    setProofPreview(null); setProofError(null); setProofExplanation("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setProofError("File must be under 10MB"); return; }
    setProofFile(file); setProofError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proofTask) return;
    setSubmittingProof(true); setProofError(null);

    let contentUrl: string | null = null;
    let contentText: string | null = null;

    if (proofType === "text") {
      if (!proofText.trim()) { setProofError("Please describe your proof."); setSubmittingProof(false); return; }
      contentText = proofText.trim();
    } else if (proofType === "link") {
      if (!proofLink.trim()) { setProofError("Please enter a URL."); setSubmittingProof(false); return; }
      if (!proofExplanation.trim()) { setProofError("Please provide an explanation of what you did."); setSubmittingProof(false); return; }
      contentUrl = proofLink.trim();
      contentText = proofExplanation.trim();
    } else {
      if (!proofFile) { setProofError("Please select an image file."); setSubmittingProof(false); return; }
      if (!proofExplanation.trim()) { setProofError("Please provide an explanation of what you did."); setSubmittingProof(false); return; }
      const sanitizedFileName = proofFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `${user.id}/${proofTask.id}/${Date.now()}-${sanitizedFileName}`;
      
      // Convert File to ArrayBuffer to bypass Next.js fetch polyfill issues with File/Blob objects
      const arrayBuffer = await proofFile.arrayBuffer();
      
      const { error: uploadErr } = await supabase.storage.from("proofs").upload(fileName, arrayBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: proofFile.type
      });
      if (uploadErr) { setProofError(`Upload failed: ${uploadErr.message}`); setSubmittingProof(false); return; }
      const { data: urlData } = supabase.storage.from("proofs").getPublicUrl(fileName);
      contentUrl = urlData.publicUrl;
      contentText = proofExplanation.trim();
    }

    const { error: proofErr } = await supabase.from("proofs").insert({
      task_id: proofTask.id, room_id: proofTask.room_id,
      user_id: user.id, content_type: proofType,
      content_url: contentUrl, content_text: contentText,
    });
    if (proofErr) { setProofError(proofErr.message); setSubmittingProof(false); return; }

    const nowStr = new Date().toISOString();
    await supabase.from("tasks").update({ 
      status: "completed",
      last_completed_at: nowStr
    }).eq("id", proofTask.id);

    // Notify other room members
    const room = rooms.find((r) => r.id === proofTask.room_id);
    const { data: members } = await supabase
      .from("room_members").select("user_id")
      .eq("room_id", proofTask.room_id).neq("user_id", user.id);
    if (members && members.length > 0) {
      await supabase.from("notifications").insert(
        members.map((m) => ({
          user_id: m.user_id, room_id: proofTask.room_id,
          task_id: proofTask.id,
          message: `🎉 ${profile?.display_name || "A member"} completed "${proofTask.title}" in ${room?.name || "a room"}`,
          is_read: false, type: "task_complete",
        }))
      );
    }

    setTasks((prev) => prev.map((t) => t.id === proofTask.id ? { ...t, status: "completed", last_completed_at: nowStr } : t));
    setProofTask(null); setSubmittingProof(false);
  };

  const toggleRecurring = async (task: Task) => {
    const newStatus = !task.is_recurring;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_recurring: newStatus } : t));
    await supabase.from("tasks").update({ is_recurring: newStatus }).eq("id", task.id);
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");
  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const TaskCard = ({ task }: { task: Task }) => {
    const room = rooms.find((r) => r.id === task.room_id);
    const isDone = task.status === "completed";
    const canEdit = !isDone && isTaskEditable(task);
    const minsLeft = editMinutesLeft(task);
    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`glass-card rounded-2xl p-5 flex items-start gap-4 group transition-all ${isDone ? "opacity-60" : ""}`}>
        <button onClick={() => !isDone && openProofModal(task)}
          title={isDone ? "Completed" : "Submit proof to complete"}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isDone ? "bg-accent border-accent cursor-default" : "border-border hover:border-primary cursor-pointer"}`}>
          {isDone && <Check size={13} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {room && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{room.name}</span>}
            {task.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} />{new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {!isDone && !canEdit && (
              <span className="text-xs text-muted-foreground/60 flex items-center gap-1" title="Edit window expired">
                <Lock size={10} />Edit locked
              </span>
            )}
            {!isDone && canEdit && minsLeft <= 10 && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <Clock size={10} />{minsLeft}m left to edit
              </span>
            )}
            {task.is_recurring && (
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Repeat size={10} /> Recurring
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => toggleRecurring(task)} title={task.is_recurring ? "Remove recurring" : "Make recurring"}
            className={`p-2 rounded-lg transition-all ${task.is_recurring ? "text-indigo-400 hover:bg-indigo-400/10" : "text-muted-foreground hover:text-indigo-400 hover:bg-indigo-400/10"}`}>
            <RefreshCw size={14} />
          </button>
          {!isDone && (
            <>
              {canEdit ? (
              <button onClick={() => openEditModal(task)} title="Edit task (within 30 min of creation)"
                className="p-2 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                <Pencil size={14} />
              </button>
            ) : (
              <button
                onClick={showExpiredToast}
                title="Edit window expired (tasks can only be edited within 30 minutes of creation)"
                className="p-2 rounded-lg text-muted-foreground/40 cursor-not-allowed">
                <Lock size={14} />
              </button>
            )}
            <button onClick={() => openProofModal(task)} title="Submit proof"
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              <Upload size={15} />
            </button>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  const proofTypeOptions = [
    { id: "text", label: "Text", icon: FileText },
    { id: "link", label: "Link", icon: LinkIcon },
    { id: "image", label: "Image", icon: ImageIcon },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Expired-edit toast */}
      <AnimatePresence>
        {editExpiredToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-card border border-border px-5 py-3 rounded-2xl shadow-2xl text-sm"
          >
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>
              <span className="font-semibold text-amber-400">Edit locked.</span>{" "}
              Tasks can only be edited within 30 minutes of creation.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Track your daily commitments</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          <Plus size={16} /> Add Task
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl bg-card animate-pulse border border-border" />)}</div>
      ) : tasks.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-16 text-center">
          <CheckSquare size={48} className="mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No tasks yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Add your first task to start tracking your commitments.</p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            <Plus size={15} /> Add Task
          </button>
        </motion.div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h3 className="font-semibold text-sm">Pending <span className="text-muted-foreground font-normal">({pending.length})</span></h3>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {pending.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">All caught up! 🎉</p>
                  : pending.map((t) => <TaskCard key={t.id} task={t} />)}
              </AnimatePresence>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              <h3 className="font-semibold text-sm">Completed <span className="text-muted-foreground font-normal">({completed.length})</span></h3>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {completed.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No completed tasks yet.</p>
                  : completed.map((t) => <TaskCard key={t.id} task={t} />)}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">Add Task</h3>
                  <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <form onSubmit={handleAdd} className="space-y-4">
                  {addError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">{addError}</p>}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Task Title *</label>
                    <input required className={inputClass} placeholder="What do you need to do?"
                      value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Description</label>
                    <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Optional details"
                      value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Room *</label>
                    <select required className={inputClass} value={form.room_id}
                      onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                      <option value="">Select a room</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Due Date</label>
                    <input type="date" className={inputClass} min={today}
                      value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Past dates are not allowed</p>
                  </div>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/20 cursor-pointer hover:bg-secondary/40 transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Make it a recurring task</p>
                      <p className="text-xs text-muted-foreground">This task will reset daily until completed or expired.</p>
                    </div>
                  </label>
                  <button type="submit" disabled={adding}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-70">
                    {adding ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={16} /> Add Task</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editTask && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !editing && setEditTask(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Pencil size={15} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold">Edit Task</h3>
                  </div>
                  <button onClick={() => !editing && setEditTask(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <form onSubmit={handleEdit} className="space-y-4">
                  {editError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">{editError}</p>}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Task Title *</label>
                    <input required className={inputClass} placeholder="What do you need to do?"
                      value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Description</label>
                    <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Optional details"
                      value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Due Date</label>
                    <input type="date" className={inputClass} min={today}
                      value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                  </div>
                  <button type="submit" disabled={editing}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-500/90 transition-all disabled:opacity-70">
                    {editing ? <Loader2 size={18} className="animate-spin" /> : <><Pencil size={15} /> Save Changes</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Proof of Work Modal */}
      <AnimatePresence>
        {proofTask && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !submittingProof && setProofTask(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Shield size={16} className="text-primary" />
                    </div>
                    <h3 className="text-lg font-bold">Submit Proof of Work</h3>
                  </div>
                  <button onClick={() => !submittingProof && setProofTask(null)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Prove you completed: <span className="font-medium text-foreground">&quot;{proofTask.title}&quot;</span>
                </p>

                {/* Proof type selector */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {proofTypeOptions.map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => { setProofType(id); setProofError(null); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${proofType === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      <Icon size={18} />{label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleProofSubmit} className="space-y-4">
                  {proofError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">{proofError}</p>}

                  {proofType === "text" && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Describe your proof *</label>
                      <textarea className={`${inputClass} resize-none`} rows={4}
                        placeholder="Describe what you did, your results, or any evidence of completion..."
                        value={proofText} onChange={(e) => setProofText(e.target.value)} />
                    </div>
                  )}
                  {proofType === "link" && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Proof URL *</label>
                      <input type="url" className={inputClass} placeholder="https://..."
                        value={proofLink} onChange={(e) => setProofLink(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Link to a screenshot, video, article, or any relevant resource</p>
                    </div>
                  )}
                  {proofType === "image" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upload Image *</label>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      {proofPreview ? (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={proofPreview} alt="Proof preview" className="w-full h-48 object-cover rounded-xl border border-border" />
                          <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-full h-36 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                          <ImageIcon size={28} />
                          <span className="text-sm">Click to select image</span>
                          <span className="text-xs">Max 10MB</span>
                        </button>
                      )}
                    </div>
                  )}

                  {proofType !== "text" && (
                    <div className="space-y-1.5 mt-4">
                      <label className="text-sm font-medium">Explanation of Work *</label>
                      <textarea className={`${inputClass} resize-none`} rows={3}
                        placeholder="Explain what you did or what this proof represents..."
                        value={proofExplanation} onChange={(e) => setProofExplanation(e.target.value)} />
                    </div>
                  )}

                  <button type="submit" disabled={submittingProof}
                    className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-semibold hover:bg-accent/90 transition-all disabled:opacity-70">
                    {submittingProof ? <Loader2 size={18} className="animate-spin" /> : <><Check size={16} /> Mark as Complete</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
