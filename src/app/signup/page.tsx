"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, ArrowRight, Loader2, HandCoins, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Signup() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });


    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Unexpected error — please try again.");
      setIsLoading(false);
      return;
    }

    // 2. Upsert profile row (handles cases where trigger isn't set up)
    await supabase.from("users").upsert({
      id: userId,
      email,
      display_name: displayName,
      coins: 100,
    });

    // 3. If email confirmation is disabled, redirect immediately
    if (authData.session) {
      router.push("/dashboard");
    } else {
      // Email confirmation required — show success message
      setSuccess(true);
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="glass-card p-10 rounded-3xl">
            <div className="inline-flex bg-accent/10 text-accent p-4 rounded-2xl mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-3">Check your email!</h2>
            <p className="text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>. Click it
              to activate your account and start earning coins.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 mt-8 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all"
            >
              Back to Login <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex bg-primary text-primary-foreground p-3 rounded-2xl mb-4 shadow-lg shadow-primary/20">
            <Target size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create an account
          </h1>
          <p className="text-muted-foreground mt-2">
            Join MoveUp and get your first 100 coins free.
          </p>
        </div>

        <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 bg-primary/10 w-32 h-32 rounded-full blur-3xl" />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl mb-5 text-sm"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium ml-1">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="How should we call you?"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium ml-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium ml-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Create a strong password"
              />
            </div>

            <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-start gap-3 mt-2">
              <HandCoins className="text-primary shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-primary/90">
                <strong>Bonus!</strong> Creating an account instantly grants you{" "}
                <strong>100 default coins</strong> to join your first challenge
                rooms.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 mt-4 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Sign Up <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground relative z-10">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-foreground font-medium hover:text-primary transition-colors"
            >
              Log in instead
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
