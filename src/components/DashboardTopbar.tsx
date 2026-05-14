"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, DoorOpen, CheckSquare, Coins,
  Bell, LogOut, Menu, X,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Overview",      href: "/dashboard",               icon: LayoutDashboard, exact: true },
  { label: "My Rooms",      href: "/dashboard/rooms",         icon: DoorOpen },
  { label: "Tasks",         href: "/dashboard/tasks",         icon: CheckSquare },
  { label: "Coins",         href: "/dashboard/coins",         icon: Coins },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

const pageTitles: Record<string, string> = {
  "/dashboard":               "Overview",
  "/dashboard/rooms":         "My Rooms",
  "/dashboard/tasks":         "Tasks",
  "/dashboard/coins":         "Coins",
  "/dashboard/notifications": "Notifications",
};

export default function DashboardTopbar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { profile, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);

  const pageTitle = pageTitles[pathname] ?? "Dashboard";

  // ── Fetch initial unread count ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  // ── Real-time: listen for new notifications ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`topbar-notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => setUnreadCount((c) => c + 1)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async () => {
          const { count } = await supabase
            .from("notifications").select("*", { count: "exact", head: true })
            .eq("user_id", user.id).eq("is_read", false);
          setUnreadCount(count ?? 0);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Reset count when visiting notifications page
  useEffect(() => {
    if (pathname === "/dashboard/notifications") setUnreadCount(0);
  }, [pathname]);

  const handleSignOut = async () => { await signOut(); router.push("/"); };

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <>
      <header className="lg:pl-64 fixed top-0 left-0 right-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Notification bell with unread badge */}
            <Link href="/dashboard/notifications"
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <Bell size={18} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span key="badge"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="hidden sm:block text-sm font-medium">{profile?.display_name ?? "User"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <div className="bg-primary text-primary-foreground p-1.5 rounded-xl"><Logo size={18} /></div>
                  <span className="font-bold text-lg">MoveUp</span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive(item) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}>
                    <item.icon size={18} />
                    {item.label}
                    {/* Unread badge on mobile nav */}
                    {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                      <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between bg-primary/10 px-4 py-2.5 rounded-xl mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Coins size={14} /><span>Coins</span>
                  </div>
                  <span className="font-bold text-primary text-sm">{profile?.coins ?? 0}</span>
                </div>
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
