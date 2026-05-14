"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Users, Trophy, ArrowDownLeft, ArrowUpRight,
  ShoppingCart, X, FileText, Link as LinkIcon, ImageIcon, CheckCircle2,
  Clock, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Notification, type Task, type Proof } from "@/lib/supabase";

const typeIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  member_join:   { icon: Users,         color: "text-blue-400",    bg: "bg-blue-400/10" },
  task_complete: { icon: Trophy,        color: "text-accent",      bg: "bg-accent/10" },
  coin_transfer: { icon: ArrowUpRight,  color: "text-orange-400",  bg: "bg-orange-400/10" },
  coin_receive:  { icon: ArrowDownLeft, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  coin_buy:      { icon: ShoppingCart,  color: "text-violet-400",  bg: "bg-violet-400/10" },
  general:       { icon: Bell,          color: "text-primary",     bg: "bg-primary/10" },
};

type ProofModal = { task: Task; proof: Proof | null; memberName: string };

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Proof viewer modal
  const [proofModal, setProofModal] = useState<ProofModal | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); /* eslint-disable-next-line */ }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const openProofViewer = async (notif: Notification) => {
    if (notif.type !== "task_complete" || !notif.task_id) return;
    setLoadingProof(true);
    markRead(notif.id);

    const [{ data: taskData }, { data: proofData }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", notif.task_id).single(),
      supabase.from("proofs").select("*").eq("task_id", notif.task_id).order("created_at", { ascending: false }).limit(1),
    ]);

    if (taskData) {
      // Extract member name from notification message (between start and "completed")
      const match = notif.message.match(/🎉\s(.+?)\s+completed/);
      const memberName = match?.[1] ?? "A member";
      setProofModal({ task: taskData as Task, proof: (proofData?.[0] as Proof) ?? null, memberName });
    }
    setLoadingProof(false);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            Notifications
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="ml-3 text-sm bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-medium inline-block">
                  {unreadCount} new
                </motion.span>
              )}
            </AnimatePresence>
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">Updates from your rooms and activity</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition-colors">
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl bg-card animate-pulse border border-border" />)}</div>
      ) : notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-20 text-center">
          <Bell size={48} className="mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">All clear!</h3>
          <p className="text-muted-foreground text-sm">
            No notifications yet. They&apos;ll appear here when there&apos;s activity in your rooms or coin transactions.
          </p>
        </motion.div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {notifications.map((notif, i) => {
                const typeCfg = typeIcons[notif.type ?? "general"] ?? typeIcons.general;
                const Icon = typeCfg.icon;
                const isTaskComplete = notif.type === "task_complete" && !!notif.task_id;
                return (
                  <motion.div key={notif.id}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-start gap-4 px-5 py-4 transition-colors ${!notif.is_read ? "bg-primary/5" : ""} ${isTaskComplete ? "hover:bg-secondary/30 cursor-pointer" : "hover:bg-secondary/20"}`}
                    onClick={isTaskComplete ? () => openProofViewer(notif) : undefined}>
                    <div className={`w-10 h-10 rounded-xl ${typeCfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon size={18} className={typeCfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? "font-medium" : "text-muted-foreground"}`}>{notif.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-muted-foreground">{timeAgo(notif.created_at)}</p>
                        {isTaskComplete && (
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <CheckCircle2 size={11} /> View proof
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notif.is_read && (
                        <>
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <button onClick={(e) => { e.stopPropagation(); markRead(notif.id); }}
                            title="Mark as read"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors">
                            <Check size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Loading spinner while fetching proof */}
      <AnimatePresence>
        {loadingProof && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <Loader2 size={36} className="text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proof Viewer Modal */}
      <AnimatePresence>
        {proofModal && !loadingProof && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setProofModal(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Trophy size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Task Completed</h3>
                      <p className="text-xs text-muted-foreground">by {proofModal.memberName}</p>
                    </div>
                  </div>
                  <button onClick={() => setProofModal(null)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Task details */}
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Task</p>
                    <p className="font-semibold text-base">{proofModal.task.title}</p>
                    {proofModal.task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{proofModal.task.description}</p>
                    )}
                    {proofModal.task.due_date && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock size={11} />Due {new Date(proofModal.task.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Proof section */}
                  {proofModal.proof ? (
                    <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4">
                      <p className="text-xs font-semibold text-accent mb-3 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Proof of Work
                      </p>

                      {proofModal.proof.content_type === "text" && (
                        <div className="flex gap-2.5">
                          <FileText size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground leading-relaxed">{proofModal.proof.content_text}</p>
                        </div>
                      )}

                      {proofModal.proof.content_type === "link" && (
                        <div className="flex items-center gap-2.5">
                          <LinkIcon size={15} className="text-muted-foreground shrink-0" />
                          <a href={proofModal.proof.content_url ?? "#"} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-primary underline underline-offset-2 break-all hover:text-primary/80">
                            {proofModal.proof.content_url}
                          </a>
                        </div>
                      )}

                      {proofModal.proof.content_type === "image" && proofModal.proof.content_url && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <ImageIcon size={15} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Image proof</span>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={proofModal.proof.content_url} alt="Proof"
                            className="w-full max-h-56 object-cover rounded-xl border border-border" />
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-3">
                        Submitted {new Date(proofModal.proof.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-secondary/40 rounded-2xl p-4 text-center text-sm text-muted-foreground">
                      No proof was submitted for this task.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
