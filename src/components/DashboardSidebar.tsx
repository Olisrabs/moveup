"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Target,
  LayoutDashboard,
  DoorOpen,
  CheckSquare,
  Coins,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "My Rooms", href: "/dashboard/rooms", icon: DoorOpen },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Coins", href: "/dashboard/coins", icon: Coins },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-border bg-card/50 backdrop-blur-xl z-40">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
            className="bg-primary text-primary-foreground p-2 rounded-xl"
          >
            <Target size={20} />
          </motion.div>
          <span className="font-bold text-lg tracking-tight">MoveUp</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group relative",
                active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                size={18}
                className={cn("relative z-10", active ? "text-primary-foreground" : "")}
              />
              <span className="relative z-10">{item.label}</span>
              {active && (
                <ChevronRight size={14} className="ml-auto relative z-10 opacity-70" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Coin balance */}
        <div className="flex items-center justify-between bg-primary/10 px-4 py-2.5 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Coins size={16} />
            <span>Coins</span>
          </div>
          <span className="font-bold text-primary text-sm">
            {profile?.coins ?? 0}
          </span>
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.display_name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile?.email ?? ""}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Log out"
            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
