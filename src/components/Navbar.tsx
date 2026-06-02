"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, LayoutDashboard, LogOut, Loader2 } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { formatNaira } from "@/lib/supabase";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  const links = [
    { name: "Home", href: "/" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "About Us", href: "/about" },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="mx-auto max-w-5xl glass rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
            className="bg-primary text-primary-foreground p-1.5 rounded-xl"
          >
            <Logo size={24} />
          </motion.div>
          <span className="font-bold text-xl tracking-tight">MoveUp</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </motion.div>
            ) : user ? (
              /* ---- Authenticated state ---- */
              <motion.div
                key="authed"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3"
              >
                {/* Wallet balance chip */}
                <div className="hidden md:flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                  <Wallet size={14} />
                  <span>{formatNaira(profile?.balance ?? 0)}</span>
                </div>

                {/* Dashboard link */}
                <Link
                  href="/dashboard"
                  className={cn(
                    "hidden md:flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary",
                    pathname.startsWith("/dashboard")
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="hidden md:inline">Log out</span>
                </button>
              </motion.div>
            ) : (
              /* ---- Unauthenticated state ---- */
              <motion.div
                key="unauthed"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3"
              >
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                >
                  Get Started
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
