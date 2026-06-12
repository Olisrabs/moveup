"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, TrendingUp, ArrowDownToLine,
  ArrowUpFromLine, X, Loader2, Check, AlertCircle,
  Building2, CreditCard, Trophy, BadgeDollarSign, RefreshCcw,
  Clock, CheckCircle2, XCircle, ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type WalletTransaction, type WithdrawalRequest, formatNaira } from "@/lib/supabase";

// ─── Transaction display config ────────────────────────────────────────────────
const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; sign: string }> = {
  fund:           { label: "Wallet Funded",    icon: ArrowDownToLine,  color: "text-emerald-500", bg: "bg-emerald-500/10", sign: "+" },
  prize_1st:      { label: "1st Place Prize",  icon: Trophy,           color: "text-yellow-500",  bg: "bg-yellow-500/10",  sign: "+" },
  prize_2nd:      { label: "2nd Place Prize",  icon: Trophy,           color: "text-slate-400",   bg: "bg-slate-400/10",   sign: "+" },
  prize_3rd:      { label: "3rd Place Prize",  icon: Trophy,           color: "text-amber-600",   bg: "bg-amber-600/10",   sign: "+" },
  refund:         { label: "Refund / Credit",  icon: RefreshCcw,       color: "text-blue-500",    bg: "bg-blue-500/10",    sign: "+" },
  commitment_fee: { label: "Commitment Fee",   icon: BadgeDollarSign,  color: "text-orange-500",  bg: "bg-orange-500/10",  sign: "-" },
  withdrawal:     { label: "Withdrawal",       icon: ArrowUpFromLine,  color: "text-red-500",     bg: "bg-red-500/10",     sign: "-" },
};

export default function WalletPage() {
  const { profile, user, refreshProfile, loading: authLoading, isSuperAdmin } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Verification states
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Fund modal
  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundSuccess, setFundSuccess] = useState(false);

  // Withdraw modal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawBankCode, setWithdrawBankCode] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawName, setWithdrawName] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);

  // Admin states
  const [adminRequests, setAdminRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminProcessingId, setAdminProcessingId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTransactions((data as WalletTransaction[]) ?? []);
  }, [user]);

  const fetchWithdrawalRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setWithdrawalRequests((data as WithdrawalRequest[]) ?? []);
  }, [user]);

  const fetchAdminRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingAdmin(true);
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*, users(display_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setAdminRequests((data as WithdrawalRequest[]) ?? []);
    setLoadingAdmin(false);
  }, [isSuperAdmin]);

  const initData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchTransactions(),
      fetchWithdrawalRequests(),
      fetchAdminRequests(),
    ]);
    setLoading(false);
  }, [fetchTransactions, fetchWithdrawalRequests, fetchAdminRequests]);

  useEffect(() => {
    initData();
  }, [initData]);

  // Check for Paystack redirect callback on mount.
  // IMPORTANT: we wait until auth has finished loading before reading the URL.
  // If we run while `user` is still null (auth not ready), the effect would bail
  // and the reference param would be consumed/lost on the next render cycle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Auth context is still resolving — don't touch the URL yet
    if (authLoading) return;
    // User is not logged in
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    // Paystack also returns `trxref` (alias). Accept both.
    const trxref = params.get("trxref");
    const finalRef = reference || trxref;

    if (!finalRef) return;

    // Remove query parameters from URL immediately so reloading doesn't re-run verification
    window.history.replaceState({}, document.title, window.location.pathname);
    setVerifyingPayment(true);

    const verify = async () => {
      try {
        const res = await fetch("/api/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Pass expectedAmount as 0 — the verify route will use the actual
          // paid amount from Paystack directly, skipping the mismatch guard
          // when not explicitly provided.
          body: JSON.stringify({ reference: finalRef, userId: user.id }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setVerificationStatus({ success: true, message: `Wallet funded successfully! ₦${data.amountCredited?.toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been credited.` });
          await refreshProfile();
          await initData();
        } else {
          setVerificationStatus({ success: false, message: data.error || "Payment verification failed. Please contact support if money was deducted." });
        }
      } catch (err: any) {
        setVerificationStatus({ success: false, message: err.message || "Failed to verify transaction. Please contact support." });
      } finally {
        setVerifyingPayment(false);
        // Keep status visible for 10 seconds so users can read it
        setTimeout(() => setVerificationStatus(null), 10000);
      }
    };
    verify();
  }, [authLoading, user, refreshProfile, initData]);

  // Fetch banks when withdraw modal opens
  useEffect(() => {
    if (!showWithdraw || banks.length > 0) return;
    setBanksLoading(true);
    fetch("/api/paystack/banks")
      .then((r) => r.json())
      .then((d) => { if (d.banks) setBanks(d.banks); })
      .finally(() => setBanksLoading(false));
  }, [showWithdraw, banks.length]);

  // Derived stats
  const totalIn  = transactions.filter((t) => typeConfig[t.type]?.sign === "+").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter((t) => typeConfig[t.type]?.sign === "-").reduce((s, t) => s + Number(t.amount), 0);

  // ─── Fund via Paystack (Hosted Redirect Flow) ────────────────────────────────
  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundError(null);
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt < 500) {
      setFundError("Minimum deposit amount is ₦500.");
      return;
    }
    if (!user || !profile?.email) {
      setFundError("User not found. Please refresh.");
      return;
    }

    setFundLoading(true);

    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          email: profile.email,
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFundError(data.error || "Could not initialize transaction.");
        setFundLoading(false);
        return;
      }

      // Redirect browser to Paystack checkout hosted page
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      console.error("Paystack redirect init error:", err);
      setFundError(err?.message || "Could not initialize checkout. Please check your internet connection.");
      setFundLoading(false);
    }
  };

  // ─── Request Withdrawal ───────────────────────────────────────────────────
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 500) { setWithdrawError("Minimum withdrawal is ₦500."); return; }
    if (!withdrawBank) { setWithdrawError("Please select a bank."); return; }
    if (!withdrawAccount || withdrawAccount.length !== 10) { setWithdrawError("Enter a valid 10-digit account number."); return; }
    if (!withdrawName.trim()) { setWithdrawError("Enter the account name."); return; }
    if (amt > Number(profile?.balance ?? 0)) { setWithdrawError("Insufficient wallet balance."); return; }

    setWithdrawLoading(true);
    const res = await fetch("/api/paystack/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user!.id,
        amount: amt,
        bankName: withdrawBank,
        accountNumber: withdrawAccount,
        accountName: withdrawName,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setWithdrawError(data.error ?? "Withdrawal request failed.");
      setWithdrawLoading(false);
      return;
    }
    await refreshProfile();
    await initData();
    setWithdrawLoading(false);
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWithdrawSuccess(false); setShowWithdraw(false);
      setWithdrawAmount(""); setWithdrawBank(""); setWithdrawBankCode(""); setWithdrawAccount(""); setWithdrawName("");
    }, 2500);
  };

  // ─── Process Withdrawal (Admin only) ──────────────────────────────────────
  const handleAdminProcess = async (requestId: string, action: "complete" | "reject") => {
    setAdminError(null);
    setAdminProcessingId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAdminError("Authentication token expired. Please reload.");
        setAdminProcessingId(null);
        return;
      }

      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdminError(data.error ?? "Failed to process request.");
        setAdminProcessingId(null);
        return;
      }

      await refreshProfile();
      await initData();
    } catch (err) {
      console.error(err);
      setAdminError("An unexpected error occurred.");
    } finally {
      setAdminProcessingId(null);
    }
  };

  // ─── Reset All Rooms & Notify (Admin only) ────────────────────────────────
  const handleResetRooms = async () => {
    if (!confirm("Are you absolutely sure you want to remove everyone from all active rooms and send out notifications? This action cannot be undone.")) return;
    setResetLoading(true);
    setResetStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setResetStatus({ success: false, message: "Authentication token expired. Please reload." });
        setResetLoading(false);
        return;
      }

      const res = await fetch("/api/admin/reset-rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetStatus({ success: false, message: data.error || "Failed to reset rooms." });
      } else {
        setResetStatus({
          success: true,
          message: `Successfully checked out all members. Sent notifications to ${data.affectedUsers} affected users. (SMTP Email Sent: ${data.smtpConfigured ? "Yes" : "No - SMTP Server not configured on Netlify"})`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setResetStatus({ success: false, message: err?.message || "An unexpected error occurred." });
    } finally {
      setResetLoading(false);
    }
  };

  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";
  const currentBalance = Number(profile?.balance ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Wallet</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Fund your account, request withdrawals, and view transaction history</p>
      </div>

      {/* Verification alerts */}
      {verifyingPayment && (
        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Verifying your payment transaction. Please do not close or refresh this page...</span>
        </div>
      )}
      {verificationStatus && (
        <div className={`border p-4 rounded-2xl text-sm flex items-center gap-2 ${
          verificationStatus.success
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            : "bg-red-500/10 border-red-500/20 text-red-500"
        }`}>
          {verificationStatus.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{verificationStatus.message}</span>
        </div>
      )}

      {/* Balance Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-violet-600 p-8 text-white">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm mb-2">Available Balance</p>
          <div className="flex items-end gap-3 mb-6">
            <span className="text-4xl md:text-5xl font-bold truncate">{formatNaira(currentBalance)}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-8">
            <div>
              <p className="text-white/60 text-xs">Total Funded</p>
              <p className="text-xl font-semibold">+{loading ? "—" : formatNaira(totalIn)}</p>
            </div>
            <div className="hidden sm:block w-px bg-white/20" />
            <div>
              <p className="text-white/60 text-xs">Total Spent/Withdrawn</p>
              <p className="text-xl font-semibold">-{loading ? "—" : formatNaira(totalOut)}</p>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setShowFund(true); setFundSuccess(false); setFundError(null); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-primary rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg">
              <ArrowDownToLine size={16} /> Fund Wallet
            </button>
            <button onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError(null); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/20 transition-all">
              <ArrowUpFromLine size={16} /> Withdraw
            </button>
          </div>
        </div>
      </motion.div>

      {/* Two columns: Transactions & Withdrawal Requests */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Transaction History */}
        <div className="space-y-4 min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet size={16} className="text-primary" /> Wallet History
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-card animate-pulse border border-border" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Wallet size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-xs">No transactions yet.</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border">
              {transactions.slice(0, 8).map((tx) => {
                const cfg = typeConfig[tx.type] ?? typeConfig.fund;
                const Icon = cfg.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={15} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{tx.description ?? cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${cfg.color}`}>{cfg.sign}{formatNaira(Number(tx.amount))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Withdrawal Tracking */}
        <div className="space-y-4 min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock size={16} className="text-primary" /> Withdrawal Requests
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-card animate-pulse border border-border" />)}</div>
          ) : withdrawalRequests.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Clock size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-xs">No withdrawal requests yet.</p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border">
              {withdrawalRequests.map((req) => (
                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-bold">{formatNaira(Number(req.amount))}</p>
                    <p className="text-xs text-muted-foreground break-words">{req.bank_name} · {req.account_number}</p>
                    <p className="text-[10px] text-muted-foreground/70">{new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    {req.status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full">
                        <Clock size={12} /> Pending Review
                      </span>
                    )}
                    {req.status === "completed" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                        <CheckCircle2 size={12} /> Sent to Bank
                      </span>
                    )}
                    {req.status === "rejected" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full">
                        <XCircle size={12} /> Rejected &amp; Refunded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Control Panel ────────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className="border border-red-500/20 bg-red-500/[0.02] rounded-3xl p-6 mt-8 space-y-4">
          <h3 className="font-bold text-red-500 flex items-center gap-2">
            <ShieldAlert size={18} /> Admin Control Panel — Pending Manual Payouts
          </h3>
          {adminError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs">
              {adminError}
            </div>
          )}
          {loadingAdmin ? (
            <div className="h-16 rounded-2xl bg-secondary/30 animate-pulse" />
          ) : adminRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-secondary/30 p-5 rounded-2xl text-center">No pending withdrawal requests in the system.</p>
          ) : (
            <div className="space-y-3">
              {adminRequests.map((req) => (
                <div key={req.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-red-500">{formatNaira(Number(req.amount))}</span>
                      <span className="text-xs text-muted-foreground font-mono">#{req.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-xs">User: <strong>{req.users?.display_name || "Unknown"}</strong> ({req.users?.email})</p>
                    <p className="text-xs">Bank: <strong>{req.bank_name}</strong> · Account: <strong>{req.account_number}</strong></p>
                    <p className="text-xs">Beneficiary: <strong>{req.account_name}</strong></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAdminProcess(req.id, "complete")}
                      disabled={adminProcessingId === req.id}
                      className="flex items-center gap-1 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      {adminProcessingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Mark Completed
                    </button>
                    <button
                      onClick={() => handleAdminProcess(req.id, "reject")}
                      disabled={adminProcessingId === req.id}
                      className="flex items-center gap-1 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {adminProcessingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Reject &amp; Refund
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Admin System Management ────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className="border border-amber-500/20 bg-amber-500/[0.02] rounded-3xl p-6 mt-8 space-y-4">
          <h3 className="font-bold text-amber-500 flex items-center gap-2">
            <ShieldAlert size={18} /> Admin Settings &amp; Actions
          </h3>
          <p className="text-xs text-muted-foreground">
            Administrative tools to manage platform-wide features and user memberships.
          </p>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-500">Reset Room Members &amp; Notify Everyone</h4>
              <p className="text-xs text-muted-foreground">
                This will automatically remove everyone from all active rooms and send them in-app and email notifications (if SMTP is configured) telling them to fund their wallet to join back.
              </p>
            </div>
            
            {resetStatus && (
              <div className={`p-3 rounded-xl text-xs ${
                resetStatus.success ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border border-red-500/20 text-red-500"
              }`}>
                {resetStatus.message}
              </div>
            )}

            <button
              onClick={handleResetRooms}
              disabled={resetLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
            >
              {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reset All Rooms &amp; Notify Everyone
            </button>
          </div>
        </div>
      )}

      {/* ── Fund Wallet Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFund && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !fundLoading && setShowFund(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl my-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Fund Wallet</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Pay securely via Paystack (card, bank transfer, USSD)</p>
                  </div>
                  <button onClick={() => !fundLoading && setShowFund(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                <form onSubmit={handleFund} className="space-y-4">
                  {fundError && (
                    <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 px-4 py-3 rounded-xl">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" /><p>{fundError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (₦) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                      <input type="number" required min={500} step="any" className={`${inputClass} pl-8`}
                        placeholder="500.00 minimum" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum deposit: ₦500</p>
                  </div>

                  {parseFloat(fundAmount) >= 500 && (() => {
                    const amt = parseFloat(fundAmount);
                    const paystackFee = amt < 2500 ? (amt * 0.015) : (amt * 0.015 + 100);
                    const finalPaystackFee = Math.min(2000, paystackFee);
                    const moveupFee = amt * 0.01;
                    const netAmount = amt - finalPaystackFee - moveupFee;

                    return (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="bg-secondary/40 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Deposit Amount</span>
                          <span className="font-semibold">{formatNaira(amt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Paystack Fee</span>
                          <span className="text-red-500">-{formatNaira(finalPaystackFee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MoveUp Fee (1%)</span>
                          <span className="text-red-500">-{formatNaira(moveupFee)}</span>
                        </div>
                        <div className="h-px bg-border my-1" />
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-muted-foreground">Net Credited to Wallet</span>
                          <span className="text-emerald-500">{formatNaira(netAmount)}</span>
                        </div>
                      </motion.div>
                    );
                  })()}

                  <button type="submit" disabled={fundLoading || fundSuccess}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-80 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
                    {fundSuccess ? <><Check size={18} /> Wallet Funded!</> :
                     fundLoading ? <><Loader2 size={18} className="animate-spin" /> Opening Payment…</> :
                     <><CreditCard size={16} /> Pay with Paystack</>}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">🔒 Secured by Paystack — 256-bit SSL encryption</p>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Withdraw Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWithdraw && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !withdrawLoading && setShowWithdraw(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl my-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Withdraw to Bank</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Enter details for manual bank transfer review</p>
                  </div>
                  <button onClick={() => !withdrawLoading && setShowWithdraw(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                {/* Balance warning */}
                {currentBalance < 500 && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-500">Insufficient Balance</p>
                      <p className="text-xs text-red-400 mt-0.5">You need at least ₦500 to withdraw. Your balance: <strong>{formatNaira(currentBalance)}</strong>.</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleWithdraw} className="space-y-4">
                  {withdrawError && (
                    <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 px-4 py-3 rounded-xl">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" /><p>{withdrawError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Bank *</label>
                    {banksLoading ? (
                      <div className="h-10 rounded-xl bg-secondary/40 animate-pulse" />
                    ) : (
                      <select required className={inputClass}
                        value={withdrawBankCode}
                        onChange={(e) => {
                          const opt = e.target.options[e.target.selectedIndex];
                          setWithdrawBankCode(e.target.value);
                          setWithdrawBank(opt.text);
                        }}>
                        <option value="">Select bank…</option>
                        {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Account Number *</label>
                    <input type="text" required maxLength={10} className={inputClass}
                      placeholder="10-digit NUBAN" value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Account Name *</label>
                    <input type="text" required className={inputClass}
                      placeholder="Name as on bank account" value={withdrawName}
                      onChange={(e) => setWithdrawName(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (₦) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                      <input type="number" required min={500} max={currentBalance} step="any"
                        className={`${inputClass} pl-8`} placeholder="500.00 minimum"
                        value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Available: <span className="font-medium text-foreground">{formatNaira(currentBalance)}</span></p>
                  </div>

                  {parseFloat(withdrawAmount) >= 500 && withdrawBank && withdrawAccount.length === 10 && withdrawName && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground whitespace-nowrap">Sending to</span>
                        <span className="font-semibold text-right break-words">{withdrawName} · {withdrawBank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-mono">{withdrawAccount}</span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="flex justify-between font-bold">
                        <span>Amount</span>
                        <span className="text-primary">{formatNaira(parseFloat(withdrawAmount))}</span>
                      </div>
                    </motion.div>
                  )}

                  <button type="submit" disabled={withdrawLoading || withdrawSuccess || currentBalance < 500}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-70">
                    {withdrawSuccess ? <><Check size={18} /> Requested Successfully!</> :
                     withdrawLoading ? <><Loader2 size={18} className="animate-spin" /> Submitting Request…</> :
                     <><Building2 size={16} /> Request Withdrawal</>}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">Requests are manually reviewed and processed within 24 hours.</p>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
