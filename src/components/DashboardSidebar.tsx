"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  DoorOpen,
  CheckSquare,
  Wallet,
  Bell,
  LogOut,
  ChevronRight,
  User,
  Building2,
  Crown,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { formatNaira } from "@/lib/supabase";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut, isSuperAdmin, isPartner, isStaff } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Base nav items for all users
  const baseNavItems = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: "My Rooms", href: "/dashboard/rooms", icon: DoorOpen },
    { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { label: "Wallet", href: "/dashboard/wallet", icon: Wallet },
    { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    { label: "Profile", href: "/dashboard/profile", icon: User },
  ];

  // Partner/Super Admin extras
  const partnerNavItems = isPartner
    ? [{ label: "Partner Monitor", href: "/dashboard/partner", icon: Building2 }]
    : [];

  // Super Admin extras
  const adminNavItems = isSuperAdmin
    ? [{ label: "Admin Panel", href: "/dashboard/admin", icon: Crown }]
    : [];

  const navItems = [...baseNavItems, ...partnerNavItems, ...adminNavItems];

  const isActive = (item: { href: string; exact?: boolean }) => {
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
            <Logo size={20} />
          </motion.div>
          <span className="font-bold text-lg tracking-tight">MoveUp</span>
        </Link>
      </div>

      {/* Role badge */}
      {profile?.role && profile.role !== "user" && (
        <div className="px-4 pt-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
            isSuperAdmin ? "bg-amber-500/20 text-amber-400" :
            isPartner    ? "bg-purple-500/20 text-purple-400" :
                           "bg-blue-500/20 text-blue-400"
          )}>
            {isSuperAdmin ? <Crown size={11} /> : isPartner ? <Building2 size={11} /> : <Users size={11} />}
            {isSuperAdmin ? "Super Admin" : isPartner ? `Partner${profile.business_name ? ` · ${profile.business_name}` : ""}` : "Staff"}
          </div>
        </div>
      )}

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
            <Wallet size={16} />
            <span>Wallet</span>
          </div>
          <span className="font-bold text-primary text-sm">
            {formatNaira(profile?.balance ?? 0)}
          </span>
        </div>

        {/* User info + logout */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/profile"
            title="View profile"
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0 transition-colors">
              {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {profile?.display_name ?? "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email ?? ""}
              </p>
            </div>
          </Link>
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
