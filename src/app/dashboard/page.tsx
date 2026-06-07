"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Wallet,
  DoorOpen,
  CheckSquare,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Room, type Task, formatNaira } from "@/lib/supabase";

type RoomWithMembers = Room & { member_count: number };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4 },
  }),
};

export default function DashboardOverview() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithMembers[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalProofsCount, setTotalProofsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fetch rooms the user is a member of
      const { data: memberRooms } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id);

      const roomIds = (memberRooms ?? []).map((m) => m.room_id);

      if (roomIds.length > 0) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("*")
          .in("id", roomIds)
          .eq("status", "active")
          .gt("ends_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(4);

        // Get member counts
        const roomsWithCounts: RoomWithMembers[] = await Promise.all(
          (roomData ?? []).map(async (room) => {
            const { count } = await supabase
              .from("room_members")
              .select("*", { count: "exact", head: true })
              .eq("room_id", room.id);
            return { ...room, member_count: count ?? 0 };
          })
        );
        setRooms(roomsWithCounts);
      }

      // Fetch all tasks and proofs for accurate counts and apply lazy reset
      const [
        { data: taskData },
        { count: proofCount }
      ] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("proofs").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      ]);

      setTotalProofsCount(proofCount ?? 0);

      const todayStr = new Date().toISOString().split("T")[0];
      const processedTasks = (taskData ?? []).map(t => {
        if (t.is_recurring && t.status === "completed") {
          const completedDate = t.last_completed_at ? t.last_completed_at.split("T")[0] : null;
          if (completedDate !== todayStr) {
            // Lazily update DB in background
            supabase.from("tasks").update({ status: "pending" }).eq("id", t.id).then();
            return { ...t, status: "pending" as const };
          }
        }
        return t;
      });

      setTasks(processedTasks);
      setLoading(false);
    };
    load();
  }, [user]);

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = totalProofsCount;

  const stats = [
    {
      label: "Active Rooms",
      value: rooms.length,
      icon: DoorOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Tasks Completed",
      value: completedCount,
      icon: CheckSquare,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Pending Tasks",
      value: pendingCount,
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Wallet Balance",
      value: formatNaira(profile?.balance ?? 0),
      icon: Wallet,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-purple-600 p-8 text-white"
      >
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-4 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">
              Welcome back 👋
            </p>
            <h2 className="text-3xl font-bold">
              {profile?.display_name ?? "Challenger"}
            </h2>
            <p className="text-white/70 mt-2 text-sm">
              You&apos;re on a roll. Keep pushing your goals forward.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-5 py-3 rounded-2xl">
            <Wallet size={22} />
            <div>
              <p className="text-xs text-white/70">Wallet Balance</p>
              <p className="text-2xl font-bold">{formatNaira(profile?.balance ?? 0)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="glass-card rounded-2xl p-5 flex flex-col gap-3"
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? "—" : stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active rooms + recent tasks */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Rooms */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <DoorOpen size={18} className="text-primary" />
              Active Rooms
            </h3>
            <Link
              href="/dashboard/rooms"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-10">
              <DoorOpen size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No active rooms yet.</p>
              <Link
                href="/dashboard/rooms"
                className="inline-flex items-center gap-2 mt-3 text-sm text-primary font-medium"
              >
                <Plus size={14} /> Create or join a room
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil(
                    (new Date(room.ends_at).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                );
                return (
                  <div
                    key={room.id}
                    className="flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors rounded-xl px-4 py-3 group"
                  >
                    <div>
                      <p className="text-sm font-medium">{room.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {room.member_count} member{room.member_count !== 1 ? "s" : ""} ·{" "}
                        {daysLeft}d left
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">
                        {formatNaira(Number(room.commitment_fee) * room.member_count)}
                      </p>
                      <p className="text-xs text-muted-foreground">pool</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Tasks */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <CheckSquare size={18} className="text-primary" />
              Recent Tasks
            </h3>
            <Link
              href="/dashboard/tasks"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-secondary/50 animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10">
              <CheckSquare size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
              <Link
                href="/dashboard/tasks"
                className="inline-flex items-center gap-2 mt-3 text-sm text-primary font-medium"
              >
                <Plus size={14} /> Add your first task
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-secondary/30 hover:bg-secondary/50 transition-colors rounded-xl px-4 py-3"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      task.status === "completed"
                        ? "bg-accent"
                        : "bg-orange-500"
                    }`}
                  />
                  <p
                    className={`text-sm flex-1 truncate ${
                      task.status === "completed"
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      task.status === "completed"
                        ? "bg-accent/10 text-accent"
                        : "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          Quick Actions
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              label: "Create a Room",
              desc: "Start a new accountability challenge",
              href: "/dashboard/rooms",
              icon: DoorOpen,
            },
            {
              label: "Add a Task",
              desc: "Track your daily commitments",
              href: "/dashboard/tasks",
              icon: CheckSquare,
            },
            {
              label: "My Wallet",
              desc: "View balance, fund & withdraw",
              href: "/dashboard/wallet",
              icon: TrendingUp,
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="glass-card rounded-2xl p-5 flex items-start gap-4 hover:border-primary/40 transition-all group"
            >
              <div className="bg-primary/10 text-primary p-2.5 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <action.icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {action.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
