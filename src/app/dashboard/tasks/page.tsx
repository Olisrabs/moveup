"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare, Clock, Plus, Check, X, Loader2,
  Upload, Link as LinkIcon, FileText, ImageIcon, Shield, Sparkles,
} from "lucide-react";
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
  const [form, setForm] = useState({ title: "", description: "", room_id: "", due_date: "" });

  // Proof modal
  const [proofTask, setProofTask] = useState<Task | null>(null);
  const [proofType, setProofType] = useState<"text" | "link" | "image">("text");
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Score reveal
  const [aiScoring, setAiScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; reasoning: string; taskTitle: string } | null>(null);


  const fetchData = async () => {
    if (!user) return;
    const [{ data: taskData }, { data: memberRooms }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
    ]);
    setTasks(taskData ?? []);
    const roomIds = (memberRooms ?? []).map((m) => m.room_id);
    if (roomIds.length > 0) {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, name, code, description, duration_days, commitment_fee, max_members, created_by, status, created_at, ends_at")
        .in("id", roomIds).eq("status", "active");
      setRooms(roomData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAdding(true); setAddError(null);
    const { error } = await supabase.from("tasks").insert({
      title: form.title, description: form.description || null,
      room_id: form.room_id, user_id: user.id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    });
    if (error) { setAddError(error.message); setAdding(false); return; }
    setShowAdd(false);
    setForm({ title: "", description: "", room_id: "", due_date: "" });
    fetchData(); setAdding(false);
  };

  const openProofModal = (task: Task) => {
    if (task.status === "completed") return;
    setProofTask(task); setProofType("text");
    setProofText(""); setProofLink(""); setProofFile(null);
    setProofPreview(null); setProofError(null);
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
      contentUrl = proofLink.trim();
    } else {
      if (!proofFile) { setProofError("Please select an image file."); setSubmittingProof(false); return; }
      const fileName = `${user.id}/${proofTask.id}/${Date.now()}-${proofFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("proofs").upload(fileName, proofFile);
      if (uploadErr) { setProofError(`Upload failed: ${uploadErr.message}`); setSubmittingProof(false); return; }
      const { data: urlData } = supabase.storage.from("proofs").getPublicUrl(fileName);
      contentUrl = urlData.publicUrl;
    }

    const { error: proofErr } = await supabase.from("proofs").insert({
      task_id: proofTask.id, room_id: proofTask.room_id,
      user_id: user.id, content_type: proofType,
      content_url: contentUrl, content_text: contentText,
    });
    if (proofErr) { setProofError(proofErr.message); setSubmittingProof(false); return; }

    await supabase.from("tasks").update({ status: "completed" }).eq("id", proofTask.id);

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

    setTasks((prev) => prev.map((t) => t.id === proofTask.id ? { ...t, status: "completed" } : t));
    const completedTask = proofTask;
    const completedProofType = proofType;
    const completedProofText = proofText;
    const completedProofLink = proofLink;
    setProofTask(null); setSubmittingProof(false);

    // --- AI Scoring ---
    setAiScoring(true);
    try {
      const res = await fetch("/api/score-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: completedTask.id,
          user_id: user.id,
          room_id: completedTask.room_id,
          task_title: completedTask.title,
          task_description: completedTask.description,
          proof_type: completedProofType,
          proof_text: completedProofType === "text" ? completedProofText : undefined,
          proof_url: completedProofType === "text" ? undefined : (completedProofType === "link" ? completedProofLink : contentUrl || undefined),
        }),
      });
      if (res.ok) {
        const { score, reasoning } = await res.json();
        // Update local state so the score badge shows on the card immediately
        setTasks((prev) =>
          prev.map((t) =>
            t.id === completedTask.id
              ? { ...t, score_percentage: score, score_breakdown: reasoning }
              : t
          )
        );
        setScoreResult({ score, reasoning, taskTitle: completedTask.title });
      }
    } catch (e) {
      console.error("AI scoring request failed:", e);
    } finally {
      setAiScoring(false);
    }
  };


  const pending = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");
  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  const TaskCard = ({ task }: { task: Task }) => {
    const room = rooms.find((r) => r.id === task.room_id);
    const isDone = task.status === "completed";
    const hasScore = isDone && task.score_percentage != null;
    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`glass-card rounded-2xl p-5 flex items-start gap-4 group transition-all ${isDone ? "opacity-75" : ""}`}>
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
            {hasScore && (
              <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                <Sparkles size={10} /> {task.score_percentage?.toFixed(1)}% AI Score
              </span>
            )}
          </div>
          {hasScore && task.score_breakdown && (
            <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">{task.score_breakdown}</p>
          )}
        </div>
        {!isDone && (
          <button onClick={() => openProofModal(task)} title="Submit proof"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
            <Upload size={15} />
          </button>
        )}
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

      {/* AI Scoring Overlay — shown while Gemini is processing */}
      <AnimatePresence>
        {aiScoring && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-xs w-full mx-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles size={28} className="text-white animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-bold text-base">AI is scoring your task…</p>
                <p className="text-sm text-muted-foreground mt-1">Analysing complexity & proof quality</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score Reveal Modal — shown after Gemini returns */}
      <AnimatePresence>
        {scoreResult && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setScoreResult(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", bounce: 0.35 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-sm shadow-2xl text-center">
                {/* Animated score ring */}
                <div className="relative w-28 h-28 mx-auto mb-5">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#scoreGrad)" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - scoreResult.score / 100) }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Sparkles size={14} className="text-primary mb-0.5" />
                    <motion.p
                      className="text-2xl font-extrabold leading-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      {scoreResult.score.toFixed(0)}%
                    </motion.p>
                  </div>
                </div>

                <h3 className="font-bold text-lg mb-1">AI Score Awarded!</h3>
                <p className="text-xs text-muted-foreground mb-3 truncate">For: &quot;{scoreResult.taskTitle}&quot;</p>

                <div className="bg-secondary/40 rounded-2xl px-4 py-3 text-left mb-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Reasoning</p>
                  <p className="text-sm leading-relaxed">{scoreResult.reasoning}</p>
                </div>

                {/* Score tier label */}
                <div className={`text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 mb-5 ${
                  scoreResult.score >= 70 ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" :
                  scoreResult.score >= 35 ? "bg-primary/15 text-primary border border-primary/20" :
                  "bg-secondary text-muted-foreground border border-border"
                }`}>
                  {scoreResult.score >= 70 ? "⚡ High Complexity" :
                   scoreResult.score >= 35 ? "💪 Moderate Effort" :
                   "📝 Simple Task"}
                </div>

                <p className="text-xs text-muted-foreground mb-4">This score has been added to your room leaderboard. Complete more complex tasks to climb higher!</p>

                <button
                  onClick={() => setScoreResult(null)}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all"
                >
                  Awesome, keep going! 🚀
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
