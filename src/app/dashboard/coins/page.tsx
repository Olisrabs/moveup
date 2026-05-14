"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, TrendingUp, TrendingDown, Gift, ShoppingCart,
  Send, X, Loader2, Check, AlertCircle, Zap, Crown, Rocket, Star,
  ArrowUpRight, ArrowDownLeft, Trophy, Package,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type CoinTransaction } from "@/lib/supabase";

// ─── Transaction display config ───────────────────────────────────────────────
const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; sign: string }> = {
  reward:             { label: "Reward",          icon: TrendingUp,     color: "text-accent",      bg: "bg-accent/10",      sign: "+" },
  task_reward:        { label: "Task Reward",      icon: Check,          color: "text-accent",      bg: "bg-accent/10",      sign: "+" },
  bonus:              { label: "Bonus",            icon: Gift,           color: "text-blue-500",    bg: "bg-blue-500/10",    sign: "+" },
  buy:                { label: "Purchase",         icon: ShoppingCart,   color: "text-violet-500",  bg: "bg-violet-500/10",  sign: "+" },
  transfer_received:  { label: "Received",         icon: ArrowDownLeft,  color: "text-emerald-500", bg: "bg-emerald-500/10", sign: "+" },
  pool_win:           { label: "Pool Win",         icon: Trophy,         color: "text-yellow-500",  bg: "bg-yellow-500/10",  sign: "+" },
  deduction:          { label: "Deduction",        icon: TrendingDown,   color: "text-red-500",     bg: "bg-red-500/10",     sign: "-" },
  transfer_sent:      { label: "Sent",             icon: ArrowUpRight,   color: "text-orange-500",  bg: "bg-orange-500/10",  sign: "-" },
  pool_loss:          { label: "Pool Loss",        icon: TrendingDown,   color: "text-red-500",     bg: "bg-red-500/10",     sign: "-" },
};

// ─── Buy Plans ────────────────────────────────────────────────────────────────
const PLANS = [
  { id: "starter",  label: "Starter",  coins: 50,   priceUSD: 1.99,  icon: Zap,    color: "text-blue-400",   border: "border-blue-400/30",   bg: "bg-blue-400/5" },
  { id: "standard", label: "Standard", coins: 150,  priceUSD: 4.99,  icon: Package,color: "text-primary",    border: "border-primary/30",    bg: "bg-primary/5" },
  { id: "pro",      label: "Pro",      coins: 500,  priceUSD: 14.99, icon: Rocket, color: "text-violet-400", border: "border-violet-400/30", bg: "bg-violet-400/5", popular: true },
  { id: "elite",    label: "Elite",    coins: 1500, priceUSD: 39.99, icon: Crown,  color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-400/5" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$",  rate: 1 },
  { code: "EUR", symbol: "€",  rate: 0.92 },
  { code: "GBP", symbol: "£",  rate: 0.79 },
  { code: "NGN", symbol: "₦",  rate: 1580 },
];

export default function CoinsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Buy modal
  const [showBuy, setShowBuy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(PLANS[2]);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [buying, setBuying] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const fetchTransactions = async () => {
    if (!user) return;
    const { data } = await supabase.from("coin_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); /* eslint-disable-next-line */ }, [user]);

  // ─── Derived stats ──────────────────────────────────────────────────────────
  const totalEarned = transactions.filter((t) => ["+"].includes(typeConfig[t.type]?.sign ?? "")).reduce((s, t) => s + t.amount, 0);
  const totalSpent  = transactions.filter((t) => (typeConfig[t.type]?.sign ?? "") === "-").reduce((s, t) => s + t.amount, 0);

  // ─── Buy flow ───────────────────────────────────────────────────────────────
  const handleBuy = async () => {
    if (!user) return;
    setBuying(true);
    await new Promise((r) => setTimeout(r, 1800)); // Simulate payment processing

    const coinsToAdd = selectedPlan.coins;

    // Always fetch the latest balance from DB to avoid stale profile cache
    const { data: latestUser } = await supabase.from("users").select("coins").eq("id", user.id).single();
    const newBalance = (latestUser?.coins ?? profile?.coins ?? 0) + coinsToAdd;

    await supabase.from("users").update({ coins: newBalance }).eq("id", user.id);
    await supabase.from("coin_transactions").insert({
      user_id: user.id, amount: coinsToAdd, type: "buy",
      description: `Purchased ${coinsToAdd} coins (${selectedPlan.label} plan)`,
    });
    await supabase.from("notifications").insert({
      user_id: user.id, message: `🪙 You successfully purchased ${coinsToAdd} coins! New balance: ${newBalance} coins.`,
      is_read: false, type: "coin_buy",
    });

    await refreshProfile();
    await fetchTransactions();
    setBuying(false); setBuySuccess(true);
    setTimeout(() => { setBuySuccess(false); setShowBuy(false); }, 2000);
  };

  // ─── Transfer flow ──────────────────────────────────────────────────────────
  const transferFee = (amt: number) => Math.floor(amt / 5);
  const parsedAmount = parseInt(transferAmount) || 0;
  const fee = transferFee(parsedAmount);
  const totalDeducted = parsedAmount + fee;
  const currentBalance = profile?.coins ?? 0;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setTransferError(null); setTransferring(true);

    if (currentBalance <= 100) {
      setTransferError("Your coin balance must be above 100 to make transfers. Buy more coins to continue.");
      setTransferring(false); return;
    }
    if (parsedAmount < 5) {
      setTransferError("Minimum transfer amount is 5 coins.");
      setTransferring(false); return;
    }

    // Block if the transfer would bring sender's balance below 100
    const balanceAfter = currentBalance - totalDeducted;
    if (balanceAfter < 100) {
      setTransferError(
        `Transfer blocked: after sending ${parsedAmount} coins + ${fee} coin fee, your balance would be ${balanceAfter} — below the 100-coin minimum. You can send at most ${Math.max(0, currentBalance - 100 - Math.floor((currentBalance - 100) / 6))} coins.`
      );
      setTransferring(false); return;
    }
    if (totalDeducted > currentBalance) {
      setTransferError(`Insufficient balance. You need ${totalDeducted} coins (${parsedAmount} + ${fee} fee) but have ${currentBalance}.`);
      setTransferring(false); return;
    }

    // Look up recipient
    const { data: recipient } = await supabase.from("users").select("id, display_name, coins").eq("email", transferEmail.trim().toLowerCase()).single();
    if (!recipient) {
      setTransferError("No user found with that email address.");
      setTransferring(false); return;
    }
    if (recipient.id === user.id) {
      setTransferError("You cannot transfer coins to yourself.");
      setTransferring(false); return;
    }

    // Re-fetch both balances fresh from DB right before writing (prevent race conditions)
    const [{ data: senderFresh }, { data: recipientFresh }] = await Promise.all([
      supabase.from("users").select("coins").eq("id", user.id).single(),
      supabase.from("users").select("coins").eq("id", recipient.id).single(),
    ]);
    const senderBalance = senderFresh?.coins ?? currentBalance;
    const recipientBalance = recipientFresh?.coins ?? recipient.coins ?? 0;

    // Final guard using fresh values
    if (senderBalance - totalDeducted < 100) {
      setTransferError("Transfer blocked: your balance would drop below 100 coins after this transfer.");
      setTransferring(false); return;
    }

    // Deduct from sender, credit recipient (fresh values)
    await supabase.from("users").update({ coins: senderBalance - totalDeducted }).eq("id", user.id);
    await supabase.from("users").update({ coins: recipientBalance + parsedAmount }).eq("id", recipient.id);

    // Record transactions
    await supabase.from("coin_transactions").insert([
      { user_id: user.id, amount: totalDeducted, type: "transfer_sent", description: `Sent ${parsedAmount} coins to ${recipient.display_name || transferEmail} (fee: ${fee})`, related_user_id: recipient.id },
      { user_id: recipient.id, amount: parsedAmount, type: "transfer_received", description: `Received ${parsedAmount} coins from ${profile.display_name || "a user"}`, related_user_id: user.id },
    ]);

    // Notifications
    await supabase.from("notifications").insert([
      { user_id: user.id, message: `↗️ You sent ${parsedAmount} coins to ${recipient.display_name || transferEmail}. Fee: ${fee} coin(s). Remaining balance: ${senderBalance - totalDeducted} coins.`, is_read: false, type: "coin_transfer" },
      { user_id: recipient.id, message: `↘️ You received ${parsedAmount} coins from ${profile.display_name || "a user"}! New balance: ${recipientBalance + parsedAmount} coins.`, is_read: false, type: "coin_receive" },
    ]);

    await refreshProfile();
    await fetchTransactions();
    setTransferring(false); setTransferSuccess(true);
    setTimeout(() => { setTransferSuccess(false); setShowTransfer(false); setTransferEmail(""); setTransferAmount(""); }, 2000);
  };

  const inputClass = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Coins</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Your balance and transaction history</p>
      </div>

      {/* Balance Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-violet-600 p-8 text-white">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm mb-2">Total Balance</p>
          <div className="flex items-end gap-3 mb-6">
            <span className="text-6xl font-bold">{profile?.coins ?? 0}</span>
            <span className="text-2xl text-white/60 pb-2">coins</span>
          </div>
          <div className="flex gap-6 mb-8">
            <div>
              <p className="text-white/60 text-xs">Total Earned</p>
              <p className="text-xl font-semibold">+{loading ? "—" : totalEarned}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-white/60 text-xs">Total Spent</p>
              <p className="text-xl font-semibold">-{loading ? "—" : totalSpent}</p>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => { setShowBuy(true); setBuySuccess(false); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg">
              <ShoppingCart size={16} /> Buy Coins
            </button>
            <button onClick={() => { setShowTransfer(true); setTransferSuccess(false); setTransferError(null); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/20 transition-all">
              <Send size={16} /> Transfer
            </button>
          </div>
        </div>
      </motion.div>

      {/* Transaction History */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Coins size={16} className="text-primary" /> Transaction History
        </h3>
        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-2xl bg-card animate-pulse border border-border" />)}</div>
        ) : transactions.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-16 text-center">
            <Coins size={40} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No transactions yet. Join a room to start earning!</p>
          </motion.div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {transactions.map((tx, i) => {
                const cfg = typeConfig[tx.type] ?? typeConfig.bonus;
                const Icon = cfg.icon;
                return (
                  <motion.div key={tx.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description ?? cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${cfg.color}`}>{cfg.sign}{tx.amount}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Buy Coins Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBuy && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !buying && setShowBuy(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-lg shadow-2xl my-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Buy Coins</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Select a plan and currency</p>
                  </div>
                  <button onClick={() => !buying && setShowBuy(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                {/* Currency selector */}
                <div className="flex gap-2 mb-5 flex-wrap">
                  {CURRENCIES.map((c) => (
                    <button key={c.code} onClick={() => setCurrency(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${currency.code === c.code ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                      {c.symbol} {c.code}
                    </button>
                  ))}
                </div>

                {/* Plans grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {PLANS.map((plan) => {
                    const Icon = plan.icon;
                    const price = (plan.priceUSD * currency.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const isSelected = selectedPlan.id === plan.id;
                    return (
                      <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${isSelected ? `border-primary bg-primary/5` : `${plan.border} ${plan.bg} hover:border-primary/40`}`}>
                        {plan.popular && (
                          <span className="absolute -top-2.5 left-3 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-semibold">Popular</span>
                        )}
                        <Icon size={22} className={`${plan.color} mb-2`} />
                        <p className="font-bold text-sm">{plan.label}</p>
                        <p className="text-xl font-black mt-1">{plan.coins} <span className="text-sm font-normal text-muted-foreground">coins</span></p>
                        <p className={`text-sm font-semibold mt-1 ${plan.color}`}>{currency.symbol}{price}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="bg-secondary/40 rounded-xl p-4 mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">You will receive</p>
                    <p className="text-2xl font-bold">{selectedPlan.coins} <span className="text-sm font-normal text-muted-foreground">coins</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">{currency.symbol}{(selectedPlan.priceUSD * currency.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <button onClick={handleBuy} disabled={buying || buySuccess}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-80 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
                  {buySuccess ? <><Check size={18} /> Payment Successful!</> : buying ? <><Loader2 size={18} className="animate-spin" /> Processing Payment…</> : <><ShoppingCart size={16} /> Pay Now</>}
                </button>
                <p className="text-xs text-muted-foreground text-center mt-3">🔒 Simulated payment — no real charge</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Transfer Coins Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTransfer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !transferring && setShowTransfer(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Transfer Coins</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Send coins to another user</p>
                  </div>
                  <button onClick={() => !transferring && setShowTransfer(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                {/* Balance guard warning */}
                {currentBalance <= 100 && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5">
                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-500">Insufficient Balance</p>
                      <p className="text-xs text-red-400 mt-0.5">You need more than 100 coins to transfer. Your current balance is <strong>{currentBalance}</strong> coins. Buy more coins to unlock transfers.</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleTransfer} className="space-y-4">
                  {transferError && (
                    <div className="flex items-start gap-2 text-red-500 text-sm bg-red-500/10 px-4 py-3 rounded-xl">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p>{transferError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Recipient Email *</label>
                    <input type="email" required className={inputClass} placeholder="user@example.com"
                      value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Enter the email address of the recipient&apos;s MoveUp account</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (coins) *</label>
                    <input type="number" required min={5} className={inputClass} placeholder="Minimum 5 coins"
                      value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                  </div>

                  {/* Fee breakdown */}
                  {parsedAmount >= 5 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transfer amount</span>
                        <span className="font-semibold">{parsedAmount} coins</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transfer fee <span className="text-xs">(1 per 5 coins)</span></span>
                        <span className="font-semibold text-orange-500">-{fee} coin{fee !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="flex justify-between font-bold">
                        <span>Total deducted</span>
                        <span className={totalDeducted > currentBalance ? "text-red-500" : "text-foreground"}>{totalDeducted} coins</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Remaining balance</span>
                        <span>{Math.max(0, currentBalance - totalDeducted)} coins</span>
                      </div>
                    </motion.div>
                  )}

                  <button type="submit" disabled={transferring || transferSuccess || currentBalance <= 100}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-70">
                    {transferSuccess ? <><Check size={18} /> Transfer Complete!</> : transferring ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <><Send size={16} /> Send Coins</>}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
