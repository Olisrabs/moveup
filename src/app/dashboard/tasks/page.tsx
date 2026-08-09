"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare, Clock, Plus, Check, X, Loader2,
  Upload, Link as LinkIcon, FileText, ImageIcon, Shield, Pencil, Lock, Repeat, RefreshCw, Trash2,
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
import { cache, TTL } from "@/lib/cache";

const today = new Date().toISOString().split("T")[0];

export default function TasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", room_id: "", due_date: "", scheduled_time: "", is_recurring: false });

  // Edit task
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", due_date: "", scheduled_time: "" });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editExpiredToast, setEditExpiredToast] = useState(false);

  // Delete task
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Proof modal
  const [proofTask, setProofTask] = useState<Task | null>(null);
  const [proofType, setProofType] = useState<"text" | "link" | "image">("text");
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  // Multi-image state (1–4 images)
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofFilePreviews, setProofFilePreviews] = useState<string[]>([]);
  const [proofFileBuffers, setProofFileBuffers] = useState<(ArrayBuffer | null)[]>([]);
  const [proofExplanation, setProofExplanation] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async (opts?: { skipCache?: boolean }) => {
    if (!user) return;

    const TASKS_KEY = `tasks:${user.id}`;
    const ROOMS_KEY = `tasks:rooms:${user.id}`;

    // ── 1. Show cached data immediately if available ──────────────────────────
    if (!opts?.skipCache) {
      const cachedTasks = cache.getStale<Task[]>(TASKS_KEY);
      const cachedRooms = cache.getStale<Room[]>(ROOMS_KEY);
      if (cachedTasks && cachedRooms) {
        setTasks(cachedTasks);
        setRooms(cachedRooms);
        setLoading(false);
      }
    }

    // ── 2. Always revalidate from DB ──────────────────────────────────────────
    const [{ data: taskData }, { data: memberRooms }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
    ]);

    const roomIds = (memberRooms ?? []).map((m) => m.room_id);
    let loadedRooms: any[] = [];
    if (roomIds.length > 0) {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, name, code, description, duration_days, commitment_fee, max_members, created_by, status, created_at, ends_at, prize_distributed, last_reminder_at")
        .in("id", roomIds);
      loadedRooms = roomData ?? [];
      setRooms(loadedRooms);
      cache.set(ROOMS_KEY, loadedRooms, TTL.ROOMS_DETAIL);
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const processedTasks = (taskData ?? []).map(t => {
      const room = loadedRooms.find((r) => r.id === t.room_id);
      const isRoomActive = room !== undefined && room.status !== "completed" && room.prize_distributed !== true;

      if (t.is_recurring && t.status === "completed" && isRoomActive) {
        const completedDate = t.last_completed_at ? t.last_completed_at.split("T")[0] : null;
        if (completedDate !== todayStr) {
          supabase.from("tasks").update({ status: "pending" }).eq("id", t.id).then();
          return { ...t, status: "pending" as const };
        }
      }
      return t;
    });

    const activeTasks = processedTasks.filter(t => {
      const room = loadedRooms.find((r) => r.id === t.room_id);
      return room !== undefined && (t.status === "completed" || (room.status !== "completed" && room.prize_distributed !== true));
    });

    setTasks(activeTasks);
    cache.set(TASKS_KEY, activeTasks, TTL.TASKS);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [user]);

  // ── Reminder polling ─────────────────────────────────────────────────────────
  // Runs every 60 s:
  //   • Sends a "time_reminder" 10-20 min before any scheduled task
  //   • Sends a "completion_reminder" for every pending task once every 3 hours
  //   The real throttle lives in the API/DB (→ last_reminder_sent_at).
  //   The client only makes the call when it looks stale, to avoid unnecessary requests.
  const sendReminder = useCallback(async (taskId: string, type: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/tasks/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, taskId }),
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    const check = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const nowTs = Date.now();

      setTasks(prev => {
        prev.filter(t => t.status === "pending").forEach(t => {
          // ── Time-based reminder (10-20 min before scheduled start) ──
          if (t.scheduled_time) {
            const [h, m] = (t.scheduled_time as string).split(":").map(Number);
            const taskMins = h * 60 + m;
            const diff = taskMins - nowMins;
            if (diff >= 10 && diff <= 20) {
              const lastSent = t.last_reminder_sent_at
                ? new Date(t.last_reminder_sent_at).getTime()
                : 0;
              if (nowTs - lastSent > 50 * 60 * 1000) {
                sendReminder(t.id, "time_reminder");
              }
            }
          }

          // ── Completion reminder — pre-flight DB check (API enforces final throttle) ──
          // Only call the API when the DB field looks stale. This prevents flooding
          // the server on every mount; the API will still reject duplicates within 3h.
          const lastSent = t.last_reminder_sent_at
            ? new Date(t.last_reminder_sent_at).getTime()
            : 0;
          if (nowTs - lastSent > THREE_HOURS) {
            sendReminder(t.id, "completion_reminder");
          }
        });
        return prev;
      });
    };

    const interval = setInterval(check, 60_000);
    check();
    return () => clearInterval(interval);
  }, [user, sendReminder]);

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
      scheduled_time: task.scheduled_time ?? "",
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
      scheduled_time: editForm.scheduled_time || null,
    }).eq("id", editTask.id);
    if (error) { setEditError(error.message); setEditing(false); return; }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editTask.id
          ? { ...t, title: editForm.title, description: editForm.description || null, due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null, scheduled_time: editForm.scheduled_time || null }
          : t
      )
    );
    setEditTask(null); setEditing(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAdding(true); setAddError(null);
    const roomObj = rooms.find((r) => r.id === form.room_id);
    if (roomObj && (roomObj.status === "completed" || roomObj.prize_distributed)) {
      setAddError("This room has been completed. You cannot add tasks to it.");
      setAdding(false);
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description || null,
      room_id: form.room_id, user_id: user.id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      scheduled_time: form.scheduled_time || null,
      is_recurring: form.is_recurring,
    });
    if (error) { setAddError(error.message); setAdding(false); return; }
    setShowAdd(false);
    setForm({ title: "", description: "", room_id: "", due_date: "", scheduled_time: "", is_recurring: false });
    // Bust tasks cache so the new task appears fresh
    cache.invalidate(`tasks:${user.id}`);
    fetchData({ skipCache: true }); setAdding(false);
  };

  const openProofModal = (task: Task) => {
    if (task.status === "completed") return;
    const room = rooms.find((r) => r.id === task.room_id);
    if (room && (room.status === "completed" || room.prize_distributed)) {
      return;
    }
    setProofTask(task); setProofType("text");
    setProofText(""); setProofLink("");
    setProofFiles([]); setProofFilePreviews([]); setProofFileBuffers([]);
    setProofError(null); setProofExplanation("");
  };

  const MAX_IMAGES = 4;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    // Reset input so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = "";

    const remaining = MAX_IMAGES - proofFiles.length;
    const toAdd = selected.slice(0, remaining);

    const oversized = toAdd.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setProofError(`"${oversized.name}" exceeds 5 MB. Please compress it first.`);
      return;
    }
    setProofError(null);

    // Create previews
    const newPreviews = toAdd.map((f) => {
      try { return URL.createObjectURL(f); } catch { return ""; }
    });

    // Eagerly read each file into an ArrayBuffer (Android permission guard)
    const newBuffers: (ArrayBuffer | null)[] = new Array(toAdd.length).fill(null);
    toAdd.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newBuffers[i] = ev.target?.result as ArrayBuffer ?? null;
        setProofFileBuffers((prev) => {
          const next = [...prev];
          next[proofFiles.length + i] = newBuffers[i];
          return next;
        });
      };
      reader.onerror = () => console.warn("Eager read failed for", f.name);
      reader.readAsArrayBuffer(f);
    });

    setProofFiles((prev) => [...prev, ...toAdd]);
    setProofFilePreviews((prev) => [...prev, ...newPreviews]);
    setProofFileBuffers((prev) => [...prev, ...newBuffers]);
  };

  const removeProofImage = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
    setProofFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setProofFileBuffers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proofTask) return;
    setSubmittingProof(true); setProofError(null);

    const room = rooms.find((r) => r.id === proofTask.room_id);
    if (room && (room.status === "completed" || room.prize_distributed)) {
      setProofError("This room has been completed. Proof submissions are closed.");
      setSubmittingProof(false);
      return;
    }
    // Extra fields merged into the proof insert (populated per proof type below)
    const proofInsertExtra: Record<string, unknown> = {};

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
      if (proofFiles.length === 0) { setProofError("Please select at least one image."); setSubmittingProof(false); return; }
      if (!proofExplanation.trim()) { setProofError("Please provide an explanation of what you did."); setSubmittingProof(false); return; }

      // Infer MIME type from extension when browser returns empty type (common on Android)
      const inferMime = (file: File): string => {
        if (file.type) return file.type;
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const map: Record<string, string> = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
          gif: "image/gif", webp: "image/webp", heic: "image/heic",
          heif: "image/heif", bmp: "image/bmp",
        };
        return map[ext] ?? "image/jpeg";
      };

      try {
        const uploadedUrls: string[] = [];

        for (let i = 0; i < proofFiles.length; i++) {
          const file = proofFiles[i];
          const buf = proofFileBuffers[i];
          const mimeType = inferMime(file);
          const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
          const fileName = `${user.id}/${proofTask.id}/${Date.now()}-${i}-${sanitized}`;
          const blob = buf ? new Blob([buf], { type: mimeType }) : file;

          const { error: uploadErr } = await supabase.storage
            .from("proofs")
            .upload(fileName, blob, { cacheControl: "3600", upsert: false, contentType: mimeType });

          if (uploadErr) {
            setProofError(`Upload failed for image ${i + 1}: ${uploadErr.message}`);
            setSubmittingProof(false);
            return;
          }

          const { data: urlData } = supabase.storage.from("proofs").getPublicUrl(fileName);
          uploadedUrls.push(urlData.publicUrl);
        }

        contentUrl = uploadedUrls[0];          // backward-compat: primary URL
        contentText = proofExplanation.trim();

        // Store all URLs in content_urls (set via the insert below)
        Object.assign(proofInsertExtra, { content_urls: uploadedUrls });
      } catch (uploadException) {
        const msg = uploadException instanceof Error ? uploadException.message : "Unknown error";
        setProofError(`Image upload error: ${msg}. Please try a smaller image or use a different format.`);
        setSubmittingProof(false);
        return;
      }
    }

    const { error: proofErr } = await supabase.from("proofs").insert({
      task_id: proofTask.id, room_id: proofTask.room_id,
      user_id: user.id, content_type: proofType,
      content_url: contentUrl, content_text: contentText,
      ...proofInsertExtra,
    });
    if (proofErr) { setProofError(proofErr.message); setSubmittingProof(false); return; }

    const nowStr = new Date().toISOString();
    await supabase.from("tasks").update({ 
      status: "completed",
      last_completed_at: nowStr
    }).eq("id", proofTask.id);

    // Notify other room members
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
    // Bust caches so dashboard reflects the completion
    cache.invalidate(`tasks:${user.id}`);
    cache.invalidate(`dashboard:tasks:${user.id}`);
    cache.invalidate(`dashboard:proofCount:${user.id}`);
    // Clean up object URLs to free memory
    proofFilePreviews.forEach((url) => URL.revokeObjectURL(url));
    setProofFiles([]); setProofFilePreviews([]); setProofFileBuffers([]);
    setProofTask(null); setSubmittingProof(false);
  };

  const toggleRecurring = async (task: Task) => {
    const newStatus = !task.is_recurring;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_recurring: newStatus } : t));
    await supabase.from("tasks").update({ is_recurring: newStatus }).eq("id", task.id);
  };

  const handleDeleteTask = async () => {
    if (!deleteTask || !user) return;
    setDeleting(true);
    setDeleteError(null);
    // Delete associated proofs first (FK constraint)
    const { error: proofsError } = await supabase.from("proofs").delete().eq("task_id", deleteTask.id);
    if (proofsError) {
      setDeleteError(`Failed to delete task proofs: ${proofsError.message}`);
      setDeleting(false);
      return;
    }
    // Then delete the task itself
    const { error: taskError } = await supabase.from("tasks").delete().eq("id", deleteTask.id);
    if (taskError) {
      setDeleteError(`Failed to delete task: ${taskError.message}`);
      setDeleting(false);
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== deleteTask.id));
    cache.invalidate(`tasks:${user.id}`);
    cache.invalidate(`dashboard:tasks:${user.id}`);
    setDeleteTask(null);
    setDeleting(false);
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");
  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const TaskCard = ({ task }: { task: Task }) => {
    const room = rooms.find((r) => r.id === task.room_id);
    const isDone = task.status === "completed";
    const isRoomCompleted = room?.status === "completed" || room?.prize_distributed === true;
    const canEdit = !isDone && !isRoomCompleted && isTaskEditable(task);
    const minsLeft = editMinutesLeft(task);

    const formatTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
    };

    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`glass-card rounded-2xl p-5 flex items-start gap-4 group transition-all ${isDone ? "opacity-60" : ""}`}>
        <button onClick={() => !isDone && !isRoomCompleted && openProofModal(task)}
          title={isDone ? "Completed" : isRoomCompleted ? "Room completed — submissions closed" : "Submit proof to complete"}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isDone ? "bg-accent border-accent cursor-default" : isRoomCompleted ? "border-border/50 text-muted-foreground/50 cursor-not-allowed opacity-55" : "border-border hover:border-primary cursor-pointer"}`}>
          {isDone && <Check size={13} className="text-white" />}
          {!isDone && isRoomCompleted && <Lock size={10} className="text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {room && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{room.name}</span>}
            {task.scheduled_time && (
              <span className="text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full flex items-center gap-1" title="Scheduled start time">
                <Clock size={10} />⏰ {formatTime(task.scheduled_time)}
              </span>
            )}
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
        <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
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
            {!isRoomCompleted && (
              <button onClick={() => openProofModal(task)} title="Submit proof"
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                <Upload size={15} />
              </button>
            )}
            </>
          )}
          <button onClick={() => setDeleteTask(task)} title="Delete task"
            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all">
            <Trash2 size={14} />
          </button>
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
                      {rooms.filter(r => r.status !== 'completed' && !r.prize_distributed).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Due Date</label>
                    <input type="date" className={inputClass} min={today}
                      value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Past dates are not allowed</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Time <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input type="time" className={inputClass}
                      value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
                    <p className="text-xs text-muted-foreground">You&apos;ll get a reminder ~15 min before this time</p>
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Time <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input type="time" className={inputClass}
                      value={editForm.scheduled_time} onChange={(e) => setEditForm({ ...editForm, scheduled_time: e.target.value })} />
                    <p className="text-xs text-muted-foreground">You&apos;ll get a reminder ~15 min before this time</p>
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
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Upload Images * <span className="text-muted-foreground font-normal">({proofFiles.length}/{MAX_IMAGES})</span></label>
                        {proofFiles.length > 0 && proofFiles.length < MAX_IMAGES && (
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Plus size={12} /> Add more
                          </button>
                        )}
                      </div>
                      {/* Hidden file input — multiple allowed */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {proofFilePreviews.length > 0 ? (
                        <div className={`grid gap-2 ${proofFilePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {proofFilePreviews.map((src, idx) => (
                            <div key={idx} className="relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt={`Proof ${idx + 1}`}
                                className="w-full h-32 object-cover rounded-xl border border-border"
                              />
                              <button
                                type="button"
                                onClick={() => removeProofImage(idx)}
                                className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-lg text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                          {/* Add slot if under limit */}
                          {proofFiles.length < MAX_IMAGES && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="h-32 border-2 border-dashed border-border hover:border-primary/50 active:border-primary rounded-xl flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Plus size={20} />
                              <span className="text-xs">Add image</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-full h-44 border-2 border-dashed border-border hover:border-primary/50 active:border-primary rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                          <ImageIcon size={32} />
                          <span className="text-sm font-medium">Tap to select images</span>
                          <span className="text-xs">JPG, PNG, WEBP &bull; Max 5MB each &bull; Up to 4 images</span>
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
                    {submittingProof
                      ? <><Loader2 size={18} className="animate-spin" /> {proofType === "image" ? `Uploading ${proofFiles.length > 1 ? "images" : "image"}…` : "Submitting…"}</>
                      : <><Check size={16} /> Mark as Complete</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTask && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (!deleting) { setDeleteTask(null); setDeleteError(null); } }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-sm shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Delete Task?</h3>
                    <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                  </div>
                </div>
                {deleteError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl mb-4">{deleteError}</p>}
                <p className="text-sm text-muted-foreground mb-6">
                  You are about to permanently delete{" "}
                  <span className="font-semibold text-foreground">&quot;{deleteTask.title}&quot;</span>{" "}
                  and all its associated proof submissions.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setDeleteTask(null); setDeleteError(null); }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all disabled:opacity-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteTask}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-500/90 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                    {deleting ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={14} /> Delete</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
