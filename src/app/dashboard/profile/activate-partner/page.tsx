"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, KeyRound, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export default function ActivatePartnerPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !code.trim()) return;

    setLoading(true);
    setResult(null);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const res = await fetch("/api/partner/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: code.trim().toUpperCase(), businessName: businessName.trim() }),
    });

    const data = await res.json();

    if (res.ok) {
      setResult({ type: "success", message: `Partnership activated! Your access is valid until ${new Date(data.expiresAt).toLocaleDateString()}.` });
      await refreshProfile();
      setTimeout(() => router.push("/dashboard/profile"), 3000);
    } else {
      setResult({ type: "error", message: data.error ?? "Failed to activate partnership." });
    }

    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/dashboard/profile"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Profile
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">Activate Partnership</h1>
        <p className="text-muted-foreground mt-1">
          Enter your business name and the unique code provided to you by MoveUp.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-8"
      >
        {result?.type === "success" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-emerald-400">Partnership Activated!</h2>
            <p className="text-muted-foreground text-sm">{result.message}</p>
            <p className="text-xs text-muted-foreground">Redirecting to your profile…</p>
          </div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-5">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Business / Academy Name
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="e.g. CodeCraft Academy"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Partnership Code
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all tracking-widest"
                  placeholder="MUP-XXXX-XXXX-XXXX"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                The code must exactly match what was shared with you.
              </p>
            </div>

            {result?.type === "error" && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{result.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !businessName.trim() || !code.trim()}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {loading ? "Verifying code…" : "Activate Partnership"}
            </button>
          </form>
        )}
      </motion.div>

      <div className="glass rounded-2xl p-5 space-y-2">
        <p className="text-sm font-medium">Don&apos;t have a code yet?</p>
        <p className="text-xs text-muted-foreground">
          Contact the MoveUp team to inquire about our partnership program for tech academies, bootcamps, and learning organizations.
        </p>
      </div>
    </div>
  );
}
