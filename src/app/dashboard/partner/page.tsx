"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  BarChart2,
  Bell,
  TrendingUp,
  CheckSquare,
  Building2,
  Loader2,
  Calendar,
  DoorOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type StaffStat = {
  id: string;
  display_name: string | null;
  email: string | null;
  rooms: number;
  completedTasks: number;
  totalTasks: number;
  rate: number;
};

type RoomStat = {
  id: string;
  name: string;
  member_count: number;
  completion_pct: number;
  days_left: number;
  commitment_fee: number;
};

type ViewMode = "daily" | "weekly" | "monthly";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
};

export default function PartnerDashboard() {
  const { user, profile, isPartner } = useAuth();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [rooms, setRooms] = useState<RoomStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Date cutoff based on viewMode
    const cutoff = new Date();
    if (viewMode === "daily") cutoff.setDate(cutoff.getDate() - 1);
    else if (viewMode === "weekly") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);

    // Fetch my staff
    const { data: staffInvites } = await supabase
      .from("staff_invitations")
      .select("staff_user_id, staff_user:staff_user_id(display_name, email)")
      .eq("partner_id", user.id)
      .eq("status", "accepted");

    const staffIds = (staffInvites ?? [])
      .map((s: any) => s.staff_user_id)
      .filter(Boolean);

    // Fetch rooms where I or my staff are observers
    const observerIds = [user.id, ...staffIds];
    const { data: memberRows } = await supabase
      .from("room_members")
      .select("room_id")
      .in("user_id", observerIds)
      .in("member_type", ["partner_observer", "staff_observer"]);

    const roomIds = [...new Set((memberRows ?? []).map((r: any) => r.room_id))];

    // Fetch room details
    const roomStats: RoomStat[] = [];
    if (roomIds.length > 0) {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("id, name, commitment_fee, ends_at")
        .in("id", roomIds)
        .eq("status", "active");

      for (const room of roomData ?? []) {
        const { count: memberCount } = await supabase
          .from("room_members")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("member_type", "participant");

        const { count: totalTasks } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id);

        const { count: completedTasks } = await supabase
          .from("proofs")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .gte("created_at", cutoff.toISOString());

        const pct = totalTasks ? Math.round(((completedTasks ?? 0) / totalTasks) * 100) : 0;
        const daysLeft = Math.max(0, Math.ceil((new Date(room.ends_at).getTime() - Date.now()) / 86400000));

        roomStats.push({
          id: room.id,
          name: room.name,
          member_count: memberCount ?? 0,
          completion_pct: pct,
          days_left: daysLeft,
          commitment_fee: Number(room.commitment_fee),
        });
      }
    }
    setRooms(roomStats);

    // Staff stats
    const stats: StaffStat[] = [];
    for (const inv of staffInvites ?? []) {
      const staffUser = (inv as any).staff_user;
      if (!inv.staff_user_id || !staffUser) continue;

      // Count rooms this staff member is observing
      const { count: staffRooms } = await supabase
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", inv.staff_user_id)
        .eq("member_type", "staff_observer");

      // Get rooms for tasks calculation
      const { data: staffRoomRows } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", inv.staff_user_id);

      const sRoomIds = (staffRoomRows ?? []).map((r: any) => r.room_id);
      let totalT = 0, completedT = 0;
      if (sRoomIds.length > 0) {
        const { count: tt } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .in("room_id", sRoomIds);
        const { count: ct } = await supabase
          .from("proofs")
          .select("*", { count: "exact", head: true })
          .in("room_id", sRoomIds)
          .gte("created_at", cutoff.toISOString());
        totalT = tt ?? 0;
        completedT = ct ?? 0;
      }

      stats.push({
        id: inv.staff_user_id,
        display_name: staffUser.display_name,
        email: staffUser.email,
        rooms: staffRooms ?? 0,
        completedTasks: completedT,
        totalTasks: totalT,
        rate: totalT > 0 ? Math.round((completedT / totalT) * 100) : 0,
      });
    }
    setStaffStats(stats);
    setLoading(false);
  }, [user, viewMode]);

  useEffect(() => { loadData(); }, [loadData]);

  // Redirect non-partners
  useEffect(() => {
    if (!isPartner && profile) router.replace("/dashboard");
  }, [isPartner, profile, router]);

  const handleNotifyRoom = async (roomId: string, roomName: string) => {
    if (!user) return;
    setNotifying(roomId);
    setNotifyMsg(null);

    // Get all participant members of the room
    const { data: members } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("member_type", "participant");

    if (!members || members.length === 0) {
      setNotifyMsg("No participants to notify.");
      setNotifying(null);
      return;
    }

    const notifications = members.map((m: any) => ({
      user_id: m.user_id,
      room_id: roomId,
      message: `📢 ${profile?.business_name ?? profile?.display_name ?? "Your partner"} is reminding you to complete your tasks in "${roomName}". Keep up the momentum!`,
      is_read: false,
      type: "partner_reminder",
    }));

    const { error } = await supabase.from("notifications").insert(notifications);
    setNotifyMsg(error ? "Failed to send notifications." : `Notified ${members.length} member(s)!`);
    setNotifying(null);
    setTimeout(() => setNotifyMsg(null), 3000);
  };

  const totalStaff = staffStats.length;
  const totalRooms = rooms.length;
  const avgRate = staffStats.length > 0
    ? Math.round(staffStats.reduce((s, st) => s + st.rate, 0) / staffStats.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Building2 size={24} className="text-purple-400" />
          <h1 className="text-3xl font-extrabold tracking-tight">Partner Monitor</h1>
        </div>
        <p className="text-muted-foreground">
          Monitor your staff and rooms — {profile?.business_name ?? "Partner Dashboard"}
        </p>
      </motion.div>

      {/* View Mode Toggle */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
        className="flex gap-2">
        {(["daily", "weekly", "monthly"] as ViewMode[]).map((m) => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              viewMode === m
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            }`}>
            <Calendar size={12} className="inline mr-1" />
            {m}
          </button>
        ))}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Staff", value: totalStaff, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Rooms Monitored", value: totalRooms, icon: DoorOpen, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Avg Completion", value: `${avgRate}%`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i + 1} variants={fadeUp} initial="hidden" animate="show"
            className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Staff Performance */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
          <BarChart2 size={18} className="text-primary" />
          Staff Performance — <span className="capitalize text-primary">{viewMode}</span>
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : staffStats.length === 0 ? (
          <div className="text-center py-10">
            <Users size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No staff members yet. Add staff from your Profile page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staffStats.sort((a, b) => b.rate - a.rate).map((s, i) => (
              <div key={s.id} className="bg-secondary/30 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {s.display_name?.[0]?.toUpperCase() ?? "S"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.display_name ?? s.email}</p>
                      <p className="text-xs text-muted-foreground">{s.rooms} room(s) monitored</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${s.rate >= 70 ? "text-emerald-400" : s.rate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {s.rate}%
                    </span>
                    <p className="text-xs text-muted-foreground">{s.completedTasks}/{s.totalTasks} tasks</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.rate >= 70 ? "bg-emerald-500" : s.rate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${s.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Room Monitor */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
          <DoorOpen size={18} className="text-primary" />
          Rooms Overview
        </h2>

        {notifyMsg && (
          <div className="mb-4 text-sm text-emerald-400 bg-emerald-500/10 rounded-xl px-4 py-3">{notifyMsg}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-10">
            <DoorOpen size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No rooms monitored yet. Create or join a room as an observer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="bg-secondary/30 rounded-xl px-4 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{room.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.member_count} participant(s) · {room.days_left}d left
                    </p>
                  </div>
                  <button
                    onClick={() => handleNotifyRoom(room.id, room.name)}
                    disabled={notifying === room.id}
                    className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
                  >
                    {notifying === room.id ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                    Notify All
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${room.completion_pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-emerald-400 shrink-0">{room.completion_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
