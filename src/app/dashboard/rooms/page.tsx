"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DoorOpen, Plus, Users, Clock, Copy, Check, X,
  Loader2, Hash, Trophy, Medal, Star, ChevronRight, BarChart3,
  ArrowLeft, CheckCircle2, Clock3, Link as LinkIcon, FileText, ImageIcon,
  Trash2, Gift, AlertCircle, Wallet, Bell,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Room, type TaskWithProof, formatNaira } from "@/lib/supabase";

type RoomWithMembers = Room & { member_count: number };
type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  total_tasks: number;
  completed_tasks: number;
  percentage: number;
};

export default function RoomsPage() {
  const { user, profile, refreshProfile, isObserver, isPartner } = useAuth();
  const [rooms, setRooms] = useState<RoomWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Leaderboard
  const [selectedRoom, setSelectedRoom] = useState<RoomWithMembers | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // Member task view (second level of drawer)
  const [drawerView, setDrawerView] = useState<'leaderboard' | 'member-tasks'>('leaderboard');
  const [viewingMember, setViewingMember] = useState<LeaderboardEntry | null>(null);
  const [memberTasks, setMemberTasks] = useState<TaskWithProof[]>([]);
  const [loadingMemberTasks, setLoadingMemberTasks] = useState(false);
  const [viewImageModal, setViewImageModal] = useState<string | null>(null);

  // Nudge / Reminder states
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState(false);

  // Cooldown effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const checkCooldown = (lastReminderAt: string | null) => {
    if (!lastReminderAt) return 0;
    const elapsed = Date.now() - new Date(lastReminderAt).getTime();
    const remaining = Math.max(0, Math.ceil((30 * 60 * 1000 - elapsed) / 1000));
    return remaining;
  };

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendReminder = async () => {
    if (!selectedRoom || !user) return;
    setSendingReminder(true);
    setReminderError(null);
    setReminderSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setReminderError("Authentication token expired. Please reload.");
        setSendingReminder(false);
        return;
      }

      const res = await fetch("/api/rooms/remind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId: selectedRoom.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setReminderError(data.error || "Failed to send reminder.");
        if (data.cooldownRemaining) {
          setCooldownSeconds(Math.ceil(data.cooldownRemaining / 1000));
        }
        setSendingReminder(false);
        return;
      }

      setReminderSuccess(true);
      const updatedRoom = { ...selectedRoom, last_reminder_at: data.lastReminderAt };
      setSelectedRoom(updatedRoom);
      setCooldownSeconds(checkCooldown(data.lastReminderAt));
      setRooms((prev) => prev.map((r) => r.id === selectedRoom.id ? { ...r, last_reminder_at: data.lastReminderAt } : r));

      setTimeout(() => setReminderSuccess(false), 3000);
    } catch (err: any) {
      setReminderError(err?.message || "An unexpected error occurred.");
    } finally {
      setSendingReminder(false);
    }
  };

  // Create form
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", duration_days: "30", commitment_fee: "500", max_members: "" });

  // Join form
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Prize distribution & room deletion
  const [distributing, setDistributing] = useState(false);
  const [distributeError, setDistributeError] = useState<string | null>(null);
  const [distributeSuccess, setDistributeSuccess] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!user) return;
    const { data: memberRows } = await supabase.from("room_members").select("room_id").eq("user_id", user.id);
    const ids = (memberRows ?? []).map((m) => m.room_id);
    if (ids.length === 0) { setRooms([]); setLoading(false); return; }
    const { data: roomData } = await supabase.from("rooms").select("*").in("id", ids).order("created_at", { ascending: false });
    const withCounts: RoomWithMembers[] = await Promise.all(
      (roomData ?? []).map(async (room) => {
        const { count } = await supabase.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", room.id);
        return { ...room, member_count: count ?? 0 };
      })
    );
    setRooms(withCounts);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRooms(); /* eslint-disable-next-line */ }, [user]);

  const fetchLeaderboard = async (room: RoomWithMembers) => {
    // Fetch latest room data to get exact last_reminder_at
    const { data: freshRoom } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room.id)
      .single();

    const currentRoom = freshRoom ? { ...room, ...freshRoom } : room;
    setSelectedRoom(currentRoom);
    setCooldownSeconds(checkCooldown(currentRoom.last_reminder_at));

    setLoadingBoard(true);
    setLeaderboard([]);

    const { data: members } = await supabase
      .from("room_members")
      .select("user_id, room_display_name, users(display_name)")
      .eq("room_id", room.id);

    if (!members || members.length === 0) { setLoadingBoard(false); return; }

    const entries: LeaderboardEntry[] = await Promise.all(
      members.map(async (m) => {
        const [{ count: pendingCount }, { count: proofCount }] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("room_id", room.id).eq("user_id", m.user_id).eq("status", "pending"),
          supabase.from("proofs").select("*", { count: "exact", head: true }).eq("room_id", room.id).eq("user_id", m.user_id),
        ]);
        const done = proofCount ?? 0;
        const total = done + (pendingCount ?? 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userData = m.users as any;
        return {
          user_id: m.user_id,
          display_name: userData?.display_name || m.room_display_name || "Unknown",
          total_tasks: total,
          completed_tasks: done,
          percentage: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      })
    );

    entries.sort((a, b) => b.percentage - a.percentage || b.completed_tasks - a.completed_tasks);
    setLeaderboard(entries);
    setLoadingBoard(false);
  };

  const fetchMemberTasks = async (entry: LeaderboardEntry) => {
    if (!selectedRoom) return;
    setViewingMember(entry);
    setDrawerView('member-tasks');
    setLoadingMemberTasks(true);
    setMemberTasks([]);
    const { data } = await supabase
      .from('proofs')
      .select('*, tasks(*)')
      .eq('room_id', selectedRoom.id)
      .eq('user_id', entry.user_id)
      .order('created_at', { ascending: false });
      
    // Map proofs back to a shape that the UI expects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syntheticTasks: TaskWithProof[] = (data ?? []).map((proof: any) => ({
      ...proof.tasks,
      id: proof.id, // Using proof ID as unique key for rendering
      status: 'completed',
      proofs: [proof]
    }));
    
    setMemberTasks(syntheticTasks);
    setLoadingMemberTasks(false);
  };

  const backToLeaderboard = () => {
    setDrawerView('leaderboard');
    setViewingMember(null);
    setMemberTasks([]);
  };

  const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  const isRoomExpired = (room: RoomWithMembers) => new Date(room.ends_at).getTime() < Date.now();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true); setCreateError(null);
    const fee = parseFloat(form.commitment_fee);
    const currentBalance = Number(profile?.balance ?? 0);

    // Observers (partner/staff/super_admin) create rooms without paying
    if (!isObserver && currentBalance < fee) {
      setCreateError(`Insufficient wallet balance. You need ${formatNaira(fee)} to create this room but your balance is ${formatNaira(currentBalance)}.`);
      setCreating(false); return;
    }
    const endsAt = new Date(Date.now() + parseInt(form.duration_days) * 86400000).toISOString();
    const { data: roomData, error } = await supabase.from("rooms").insert({
      code: generateCode(), name: form.name, description: form.description || null,
      duration_days: parseInt(form.duration_days), commitment_fee: fee,
      max_members: form.max_members ? parseInt(form.max_members) : null,
      created_by: user.id, ends_at: endsAt,
    }).select().single();
    if (error) { setCreateError(error.message); setCreating(false); return; }

    if (isObserver) {
      // Observers join as non-competing monitors — no fee deducted
      await supabase.from("room_members").insert({
        room_id: roomData.id, user_id: user.id,
        room_display_name: profile?.display_name || form.name,
        member_type: isPartner ? "partner_observer" : "staff_observer",
        fee_waived: true,
      });
    } else {
      // Regular user — deduct commitment fee
      const newBalance = currentBalance - fee;
      await supabase.from("users").update({ balance: newBalance }).eq("id", user.id);
      await supabase.from("wallet_transactions").insert({
        user_id: user.id, amount: fee, type: "commitment_fee",
        description: `Commitment fee for room "${form.name}"`,
      });
      await supabase.from("room_members").insert({
        room_id: roomData.id, user_id: user.id,
        room_display_name: profile?.display_name || form.name,
      });
    }
    await refreshProfile();
    setShowCreate(false);
    setForm({ name: "", description: "", duration_days: "30", commitment_fee: "500", max_members: "" });
    fetchRooms(); setCreating(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setJoining(true); setJoinError(null);
    const { data: room, error } = await supabase.from("rooms").select("*").eq("code", joinCode.toUpperCase()).eq("status", "active").single();
    if (error || !room) { setJoinError("Room not found or no longer active."); setJoining(false); return; }

    const fee = Number(room.commitment_fee);
    const currentBalance = Number(profile?.balance ?? 0);

    if (isObserver) {
      // Observers join without paying
      const { error: joinErr } = await supabase.from("room_members").insert({
        room_id: room.id, user_id: user.id,
        room_display_name: joinName || profile?.display_name || "Observer",
        member_type: isPartner ? "partner_observer" : "staff_observer",
        fee_waived: true,
      });
      if (joinErr) { setJoinError(joinErr.code === "23505" ? "You are already a member of this room." : joinErr.message); setJoining(false); return; }
    } else {
      // Regular user — check balance and deduct fee
      if (currentBalance < fee) {
        setJoinError(`Insufficient wallet balance. This room requires ${formatNaira(fee)} but your balance is ${formatNaira(currentBalance)}. Fund your wallet first.`);
        setJoining(false); return;
      }
      const { error: joinErr } = await supabase.from("room_members").insert({
        room_id: room.id, user_id: user.id,
        room_display_name: joinName || profile?.display_name || "Member",
      });
      if (joinErr) { setJoinError(joinErr.code === "23505" ? "You are already a member of this room." : joinErr.message); setJoining(false); return; }
      // Deduct fee
      const newBalance = currentBalance - fee;
      await supabase.from("users").update({ balance: newBalance }).eq("id", user.id);
      await supabase.from("wallet_transactions").insert({
        user_id: user.id, amount: fee, type: "commitment_fee",
        description: `Commitment fee for joining "${room.name}"`,
      });
    }
    // Notify existing participants
    const { data: existingMembers } = await supabase.from("room_members").select("user_id").eq("room_id", room.id).neq("user_id", user.id).eq("member_type", "participant");
    if (existingMembers && existingMembers.length > 0) {
      await supabase.from("notifications").insert(
        existingMembers.map((m) => ({
          user_id: m.user_id, room_id: room.id,
          message: `👋 ${joinName || profile?.display_name || "Someone"} joined "${room.name}"`,
          is_read: false, type: "member_join",
        }))
      );
    }
    await refreshProfile();
    setShowJoin(false); setJoinCode(""); setJoinName("");
    fetchRooms(); setJoining(false);
  };

  const distributePrizes = async () => {
    if (!selectedRoom || !user) return;
    setDistributing(true); setDistributeError(null);
    // Re-fetch leaderboard
    const { data: members } = await supabase.from("room_members").select("user_id, room_display_name, users(display_name)").eq("room_id", selectedRoom.id);
    if (!members || members.length === 0) { setDistributeError("No members found."); setDistributing(false); return; }
    const entries = await Promise.all(members.map(async (m) => {
      const [{ count: pendingCount }, { count: proofCount }] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("room_id", selectedRoom.id).eq("user_id", m.user_id).eq("status", "pending"),
        supabase.from("proofs").select("*", { count: "exact", head: true }).eq("room_id", selectedRoom.id).eq("user_id", m.user_id),
      ]);
      const done = proofCount ?? 0;
      const total = done + (pendingCount ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ud = m.users as any;
      return { user_id: m.user_id, display_name: ud?.display_name || m.room_display_name || "Unknown", total, done, pct: total > 0 ? done / total : 0 };
    }));
    entries.sort((a, b) => b.pct - a.pct || b.done - a.done);
    const totalPool = Number(selectedRoom.commitment_fee) * selectedRoom.member_count;
    const prizeTypes: Array<'prize_1st' | 'prize_2nd' | 'prize_3rd'> = ['prize_1st', 'prize_2nd', 'prize_3rd'];
    const prizeLabels = ['1st place', '2nd place', '3rd place'];
    // If fewer than 4 members, only 1st gets everything
    const splits = selectedRoom.member_count < 4 ? [1, 0, 0] : [0.5, 0.3, 0.2];
    const notifications: { user_id: string; message: string; is_read: boolean; type: string; room_id: string }[] = [];
    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const pct = splits[i];
      if (pct === 0) continue;
      const prize = totalPool * pct;
      const { data: ub } = await supabase.from("users").select("balance").eq("id", entries[i].user_id).single();
      const newBal = Number(ub?.balance ?? 0) + prize;
      await supabase.from("users").update({ balance: newBal }).eq("id", entries[i].user_id);
      await supabase.from("wallet_transactions").insert({
        user_id: entries[i].user_id, amount: prize, type: prizeTypes[i],
        description: `${prizeLabels[i]} prize from room "${selectedRoom.name}" — ${formatNaira(prize)}`,
      });
      notifications.push({
        user_id: entries[i].user_id, room_id: selectedRoom.id,
        message: `🏆 You finished ${prizeLabels[i]} in "${selectedRoom.name}"! ${formatNaira(prize)} has been credited to your wallet.`,
        is_read: false, type: "prize_credit",
      });
    }
    // Notify all other members
    for (const m of members) {
      if (!entries.slice(0, 3).find(e => e.user_id === m.user_id)) {
        notifications.push({
          user_id: m.user_id, room_id: selectedRoom.id,
          message: `🏁 The room "${selectedRoom.name}" has ended. Prizes have been distributed to the top performers.`,
          is_read: false, type: "room_ended",
        });
      }
    }
    if (notifications.length > 0) await supabase.from("notifications").insert(notifications);
    await supabase.from("rooms").update({ prize_distributed: true, status: "completed" }).eq("id", selectedRoom.id);
    await refreshProfile();
    setDistributeSuccess(true);
    setTimeout(() => { setDistributeSuccess(false); setSelectedRoom(null); backToLeaderboard(); fetchRooms(); }, 2000);
    setDistributing(false);
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom || !user) return;
    setDeletingRoom(true); setDeleteError(null);
    if (!isRoomExpired(selectedRoom)) { setDeleteError("You can only delete a room after it has expired."); setDeletingRoom(false); return; }
    const { error } = await supabase.from("rooms").delete().eq("id", selectedRoom.id);
    if (error) { setDeleteError(error.message); setDeletingRoom(false); return; }
    setSelectedRoom(null); backToLeaderboard(); fetchRooms(); setDeletingRoom(false);
  };

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDaysLeft = (endsAt: string) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy size={18} className="text-yellow-400" />;
    if (i === 1) return <Medal size={18} className="text-slate-400" />;
    if (i === 2) return <Star size={18} className="text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>;
  };

  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">My Rooms</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Accountability challenge rooms you belong to</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition-colors">
            <Hash size={16} /> Join Room
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            <Plus size={16} /> Create Room
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1,2,3].map((i) => <div key={i} className="h-52 rounded-2xl bg-card animate-pulse border border-border" />)}
        </div>
      ) : rooms.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-16 text-center">
          <DoorOpen size={48} className="mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No rooms yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Create or join a room to start an accountability challenge.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              <Plus size={15} /> Create Room
            </button>
            <button onClick={() => setShowJoin(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium">
              <Hash size={15} /> Join Room
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {rooms.map((room, i) => {
            const daysLeft = getDaysLeft(room.ends_at);
            return (
              <motion.div key={room.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => fetchLeaderboard(room)}
                className="glass-card rounded-2xl p-6 flex flex-col gap-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight">{room.name}</h3>
                    {room.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{room.description}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-2 ${room.status === "active" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {room.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-secondary/40 rounded-xl p-2.5">
                    <Users size={12} className="mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm font-bold">{room.member_count}</p>
                    <p className="text-xs text-muted-foreground">members</p>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-2.5">
                    <Clock size={12} className="mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm font-bold">{daysLeft}d</p>
                    <p className="text-xs text-muted-foreground">left</p>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-2.5">
                    <Trophy size={12} className="mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm font-bold truncate">{formatNaira(Number(room.commitment_fee) * room.member_count)}</p>
                    <p className="text-xs text-muted-foreground">pool</p>
                  </div>
                </div>

                <button onClick={(e) => copyCode(room.code, e)}
                  className="flex items-center justify-between w-full bg-secondary/40 hover:bg-secondary/70 transition-colors rounded-xl px-4 py-2.5 group/copy">
                  <span className="text-xs text-muted-foreground">Room Code</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm tracking-wider">{room.code}</span>
                    {copiedCode === room.code ? <Check size={14} className="text-accent" /> : <Copy size={14} className="text-muted-foreground" />}
                  </div>
                </button>

                <div className="flex items-center justify-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity -mt-1">
                  <BarChart3 size={12} /> View Leaderboard <ChevronRight size={12} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Drawer */}
      <AnimatePresence>
        {selectedRoom && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedRoom(null); backToLeaderboard(); }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border z-50 flex flex-col shadow-2xl">

              {/* ── Drawer header — changes based on view ── */}
              <div className="flex items-center gap-3 p-5 border-b border-border">
                {drawerView === 'member-tasks' && (
                  <button onClick={backToLeaderboard}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {drawerView === 'leaderboard' ? (
                    <>
                      <h3 className="font-bold text-base truncate">{selectedRoom.name}</h3>
                      <p className="text-xs text-muted-foreground">Leaderboard — {selectedRoom.member_count} members</p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-base truncate">{viewingMember?.display_name}</h3>
                      <p className="text-xs text-muted-foreground">Tasks in {selectedRoom.name}</p>
                    </>
                  )}
                </div>
                <button onClick={() => { setSelectedRoom(null); backToLeaderboard(); }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* ── Leaderboard view ── */}
              <AnimatePresence mode="wait">
                {drawerView === 'leaderboard' && (
                  <motion.div key="leaderboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loadingBoard ? (
                      <div className="space-y-3">
                        {[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-secondary/30 animate-pulse" />)}
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground text-sm">No members found.</div>
                    ) : (
                      leaderboard.map((entry, i) => {
                        const isMe = entry.user_id === user?.id;
                        return (
                          <motion.button key={entry.user_id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => fetchMemberTasks(entry)}
                            className={`w-full rounded-2xl p-4 border text-left transition-all hover:border-primary/40 hover:shadow-sm ${
                              isMe ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/20'
                            }`}>
                            <div className="flex items-center gap-3 mb-2.5">
                              <div className="w-8 flex items-center justify-center shrink-0">{rankIcon(i)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">
                                  {entry.display_name}{isMe && <span className="text-xs text-primary font-normal ml-1">(you)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">{entry.completed_tasks}/{entry.total_tasks} tasks</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-foreground'}`}>
                                  {entry.percentage}%
                                </span>
                                <ChevronRight size={14} className="text-muted-foreground" />
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${entry.percentage}%` }}
                                transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                                className={`h-full rounded-full ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : 'bg-primary'}`} />
                            </div>
                          </motion.button>
                        );
                      })
                    )}
                    <p className="text-xs text-muted-foreground text-center pt-2">Tap a member to view their tasks &amp; proof</p>

                    {/* Pool summary */}
                    <div className="bg-secondary/30 rounded-2xl p-4 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Entry fee</span>
                        <span className="font-semibold">{formatNaira(Number(selectedRoom.commitment_fee))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total pool</span>
                        <span className="font-bold text-primary">{formatNaira(Number(selectedRoom.commitment_fee) * selectedRoom.member_count)}</span>
                      </div>
                      {selectedRoom.member_count < 4 && <p className="text-xs text-muted-foreground mt-2">⚡ 1st place wins the full pool (fewer than 4 members)</p>}
                      {selectedRoom.member_count >= 4 && <p className="text-xs text-muted-foreground mt-2">🏆 50% · 🥈 30% · 🥉 20%</p>}
                    </div>

                    {/* Send Reminder — for any member, only when room is active */}
                    {!isRoomExpired(selectedRoom) && (
                      <div className="space-y-2 pt-1">
                        {reminderError && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-xl">{reminderError}</p>}
                        {reminderSuccess && <p className="text-xs text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-xl">🔔 Reminder sent to all members!</p>}
                        
                        <button
                          onClick={handleSendReminder}
                          disabled={sendingReminder || cooldownSeconds > 0}
                          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-lg shadow-primary/10"
                        >
                          {sendingReminder ? (
                            <><Loader2 size={16} className="animate-spin" /> Sending...</>
                          ) : cooldownSeconds > 0 ? (
                            <><Clock size={16} /> Remind Members ({formatCooldown(cooldownSeconds)})</>
                          ) : (
                            <><Bell size={16} /> Remind Room Members</>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Prize distribution & delete — only for creator, only after expiry */}
                    {isRoomExpired(selectedRoom) && selectedRoom.created_by === user?.id && (
                      <div className="space-y-2 pt-1">
                        {distributeError && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-xl">{distributeError}</p>}
                        {deleteError && <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-xl">{deleteError}</p>}
                        {!selectedRoom.prize_distributed ? (
                          <button onClick={distributePrizes} disabled={distributing || distributeSuccess}
                            className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-yellow-600 transition-all disabled:opacity-70">
                            {distributeSuccess ? <><Check size={16} /> Prizes Distributed!</> :
                             distributing ? <><Loader2 size={16} className="animate-spin" /> Distributing…</> :
                             <><Gift size={16} /> Settle &amp; Distribute Prizes</>}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 px-4 py-2.5 rounded-xl">
                            <Check size={16} /> Prizes already distributed
                          </div>
                        )}
                        <button onClick={handleDeleteRoom} disabled={deletingRoom}
                          className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-500 py-2.5 rounded-xl font-medium text-sm hover:bg-red-500/10 transition-all disabled:opacity-70">
                          {deletingRoom ? <><Loader2 size={16} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Room</>}
                        </button>
                      </div>
                    )}
                    {isRoomExpired(selectedRoom) && selectedRoom.created_by !== user?.id && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 px-4 py-2.5 rounded-xl">
                        <AlertCircle size={14} /> Room has expired. Waiting for creator to distribute prizes.
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Member tasks view ── */}
                {drawerView === 'member-tasks' && (
                  <motion.div key="member-tasks" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="flex-1 overflow-y-auto p-5 space-y-4">
                    {loadingMemberTasks ? (
                      <div className="space-y-3">
                        {[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-secondary/30 animate-pulse" />)}
                      </div>
                    ) : memberTasks.length === 0 ? (
                      <div className="text-center py-16">
                        <Trophy size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm font-medium">No completed tasks yet</p>
                        <p className="text-muted-foreground text-xs mt-1">Tasks will appear here once they are completed with proof.</p>
                      </div>
                    ) : (
                      memberTasks.map((task, i) => {
                        const isDone = task.status === 'completed';
                        const proof = task.proofs?.[0] ?? null;
                        return (
                          <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-border bg-secondary/20 overflow-hidden">
                            {/* Task header */}
                            <div className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                  isDone ? 'bg-accent border-accent' : 'border-border'
                                }`}>
                                  {isDone && <Check size={12} className="text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                                  {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      isDone ? 'bg-accent/10 text-accent' : 'bg-orange-500/10 text-orange-400'
                                    }`}>{isDone ? 'Completed' : 'Pending'}</span>
                                    {task.due_date && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock3 size={10} />{new Date(task.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Proof section */}
                            {isDone && proof && (
                              <div className="border-t border-border bg-accent/5 p-4">
                                <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1.5">
                                  <CheckCircle2 size={12} /> Proof of Work
                                </p>
                                {proof.content_type === 'text' && (
                                  <div className="flex gap-2">
                                    <FileText size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-xs text-foreground leading-relaxed">{proof.content_text}</p>
                                  </div>
                                )}
                                {proof.content_type === 'link' && (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <LinkIcon size={14} className="text-muted-foreground shrink-0" />
                                      <a href={proof.content_url ?? '#'} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-primary underline underline-offset-2 truncate hover:text-primary/80">
                                        {proof.content_url}
                                      </a>
                                    </div>
                                    {proof.content_text && (
                                      <div className="flex gap-2 bg-secondary/30 p-2.5 rounded-xl border border-border mt-1">
                                        <FileText size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                                        <p className="text-xs text-foreground leading-relaxed italic">{proof.content_text}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {proof.content_type === 'image' && proof.content_url && (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <ImageIcon size={14} className="text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">Image proof</span>
                                    </div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={proof.content_url} alt="Proof" onClick={() => setViewImageModal(proof.content_url)} 
                                      className="w-full max-h-48 object-cover rounded-xl border border-border cursor-pointer hover:opacity-90 transition-opacity" />
                                    {proof.content_text && (
                                      <div className="flex gap-2 bg-secondary/30 p-2.5 rounded-xl border border-border mt-1">
                                        <FileText size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                                        <p className="text-xs text-foreground leading-relaxed italic">{proof.content_text}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                                  Submitted {new Date(proof.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            )}
                            {isDone && !proof && (
                              <div className="border-t border-border px-4 py-2">
                                <p className="text-xs text-muted-foreground italic">No proof submitted yet.</p>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <Modal onClose={() => setShowCreate(false)} title="Create a Room">
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">{createError}</p>}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Room Name *</label>
                <input required className={inputClass} placeholder="e.g. 30-Day Fitness Challenge"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <textarea className={`${inputClass} resize-none`} rows={2} placeholder="What's this challenge about?"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (days)</label>
                  <input type="number" min={1} required className={inputClass}
                    value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Entry Fee (₦)</label>
                  <input type="number" min={1} required className={inputClass}
                    value={form.commitment_fee} onChange={(e) => setForm({ ...form, commitment_fee: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Amount each member (including you) must pay to join</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Max Members (optional)</label>
                <input type="number" min={2} className={inputClass} placeholder="Leave blank for unlimited"
                  value={form.max_members} onChange={(e) => setForm({ ...form, max_members: e.target.value })} />
              </div>
              <button type="submit" disabled={creating}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-70">
                {creating ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={16} /> Create Room</>}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoin && (
          <Modal onClose={() => setShowJoin(false)} title="Join a Room">
            <form onSubmit={handleJoin} className="space-y-4">
              {joinError && <p className="text-red-500 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">{joinError}</p>}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Room Code *</label>
                <input required className={`${inputClass} uppercase font-mono tracking-widest`}
                  placeholder="XXXXXX" maxLength={6} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your display name in this room</label>
                <input className={inputClass} placeholder="Optional"
                  value={joinName} onChange={(e) => setJoinName(e.target.value)} />
              </div>
              <button type="submit" disabled={joining}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-70">
                {joining ? <Loader2 size={18} className="animate-spin" /> : <><Hash size={16} /> Join Room</>}
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* View Full Image Modal */}
      <AnimatePresence>
        {viewImageModal && (
          <Modal onClose={() => setViewImageModal(null)} title="Image Proof">
            <div className="flex items-center justify-center bg-black/5 rounded-xl overflow-hidden p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewImageModal} alt="Full screen proof" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm" />
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setViewImageModal(null)} className="px-5 py-2.5 bg-secondary text-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors">
                Close Viewer
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </>
  );
}
