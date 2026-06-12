"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  KeyRound,
  Plus,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Users,
  Loader2,
  AlertCircle,
  Building2,
  UserPlus,
  Calendar,
  UserMinus,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type PartnershipCode } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
};

function CodeStatusBadge({ code }: { code: PartnershipCode }) {
  const now = new Date();
  const expired = new Date(code.expires_at) < now;
  if (!code.is_active) return <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-medium">Disabled</span>;
  if (expired) return <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground font-medium">Expired</span>;
  if (code.used_by) return <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Active</span>;
  return <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-medium">Unused</span>;
}

export default function AdminPanelPage() {
  const { user, isSuperAdmin, profile } = useAuth();
  const router = useRouter();

  // Generate code state
  const [genBusiness, setGenBusiness] = useState("");
  const [genDuration, setGenDuration] = useState("365");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ code: string; expiresAt: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Codes list
  const [codes, setCodes] = useState<PartnershipCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Promote admin
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);

  // Admins list
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [demotingId, setDemotingId] = useState<string | null>(null);
  const [demoteError, setDemoteError] = useState<string | null>(null);

  // Redirect if not super admin
  useEffect(() => {
    if (!isSuperAdmin && profile) router.replace("/dashboard");
  }, [isSuperAdmin, profile, router]);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  };

  const fetchCodes = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingCodes(true);
    const token = await getToken();
    const res = await fetch("/api/super-admin/codes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setCodes(data.codes ?? []);
    setLoadingCodes(false);
  }, [isSuperAdmin]);

  const fetchAdmins = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingAdmins(true);
    const token = await getToken();
    const res = await fetch("/api/super-admin/admins", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) setAdmins(data.admins ?? []);
    setLoadingAdmins(false);
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchCodes();
    fetchAdmins();
  }, [fetchCodes, fetchAdmins]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenResult(null);
    setGenError(null);

    const token = await getToken();
    const res = await fetch("/api/super-admin/generate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessName: genBusiness, durationDays: Number(genDuration) }),
    });
    const data = await res.json();

    if (res.ok) {
      setGenResult({ code: data.code.code, expiresAt: data.code.expires_at });
      setGenBusiness("");
      setGenDuration("365");
      fetchCodes();
    } else {
      setGenError(data.error ?? "Failed to generate code");
    }
    setGenerating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleCode = async (codeId: string, currentActive: boolean) => {
    setTogglingId(codeId);
    const token = await getToken();
    const res = await fetch("/api/super-admin/toggle-code", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ codeId, isActive: !currentActive }),
    });
    if (res.ok) {
      setCodes((prev) => prev.map((c) => c.id === codeId ? { ...c, is_active: !currentActive } : c));
    }
    setTogglingId(null);
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoting(true);
    setPromoteMsg(null);

    const token = await getToken();
    const res = await fetch("/api/super-admin/promote-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: promoteEmail }),
    });
    const data = await res.json();

    if (res.ok) {
      setPromoteMsg(`✅ ${data.promotedUser} has been promoted to Super Admin.`);
      setPromoteEmail("");
      fetchAdmins();
    } else {
      setPromoteMsg(`❌ ${data.error}`);
    }
    setPromoting(false);
    setTimeout(() => setPromoteMsg(null), 5000);
  };

  const handleDemote = async (targetUserId: string) => {
    setDemoteError(null);
    setDemotingId(targetUserId);
    try {
      const token = await getToken();
      const res = await fetch("/api/super-admin/demote-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoteMsg(`ℹ️ ${data.demotedUser} has been demoted back to Member.`);
        fetchAdmins();
      } else {
        setDemoteError(data.error ?? "Failed to demote user");
      }
    } catch (err: any) {
      setDemoteError(err.message ?? "An unexpected error occurred");
    } finally {
      setDemotingId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-xl">
            <Crown size={22} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Panel</h1>
        </div>
        <p className="text-muted-foreground">
          Manage partnership codes, promote admins, and monitor all partners.
        </p>
      </motion.div>

      {/* Generate Partnership Code */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
          <KeyRound size={18} className="text-amber-400" />
          Generate Partnership Code
        </h2>

        {genResult && (
          <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 space-y-3">
            <p className="text-sm text-emerald-400 font-medium">✅ Code generated successfully!</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-lg font-mono font-bold tracking-widest text-foreground bg-secondary/50 px-4 py-2.5 rounded-xl">
                {genResult.code}
              </code>
              <button onClick={() => handleCopyCode(genResult.code)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium transition-all hover:bg-primary/90">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires: {new Date(genResult.expiresAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        )}

        {genError && (
          <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{genError}</p>
          </div>
        )}

        <form onSubmit={handleGenerate} className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Business Name
            </label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={genBusiness}
                onChange={(e) => setGenBusiness(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="Tech Academy Ltd"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Duration (Days)
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                min={1}
                max={1825}
                value={genDuration}
                onChange={(e) => setGenDuration(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                required
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={generating || !genBusiness.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {generating ? "Generating…" : "Generate Code"}
            </button>
          </div>
        </form>
      </motion.div>

      {/* All Partnership Codes */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
          <KeyRound size={18} className="text-primary" />
          Partnership Codes ({codes.length})
        </h2>

        {loadingCodes ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-10">
            <KeyRound size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No codes generated yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => (
              <div key={code.id} className="bg-secondary/30 rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-bold tracking-widest text-primary">
                        {code.code}
                      </code>
                      <CodeStatusBadge code={code} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{code.business_name}</span>
                      {" · "}{code.duration_days}d
                      {" · "} Expires {new Date(code.expires_at).toLocaleDateString()}
                    </p>
                    {code.used_by_user && (
                      <p className="text-xs text-emerald-400">
                        Used by: {(code.used_by_user as any)?.display_name ?? (code.used_by_user as any)?.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleCopyCode(code.code)}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy code">
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleCode(code.id, code.is_active)}
                      disabled={togglingId === code.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        code.is_active
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      }`}
                    >
                      {togglingId === code.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : code.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />
                      }
                      {code.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Promote Super Admin */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6 border border-amber-500/20">
        <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
          <UserPlus size={18} className="text-amber-400" />
          Promote to Super Admin
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Enter the email of a registered MoveUp user to grant them full Super Admin access.
        </p>

        <form onSubmit={handlePromote} className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="user@example.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={promoting || !promoteEmail.trim()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 shrink-0"
          >
            {promoting ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
            Promote
          </button>
        </form>

        {promoteMsg && (
          <p className={`text-sm mt-3 ${promoteMsg.startsWith("❌") ? "text-red-400" : "text-emerald-400"}`}>
            {promoteMsg}
          </p>
        )}

        {/* Current Admins list with demote action */}
        <div className="border-t border-border/30 pt-6 mt-6">
          <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
            <Crown size={16} className="text-amber-400" />
            Active Super Admins
          </h3>

          {demoteError && (
            <p className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-xl mb-3 flex items-center gap-1.5">
              <AlertCircle size={12} /> {demoteError}
            </p>
          )}

          {loadingAdmins ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-secondary/30 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {admins.map((adm) => {
                const isMe = adm.id === user?.id;
                const cannotRemove = adm.isPrimary || isMe;
                return (
                  <div key={adm.id} className="flex items-center justify-between bg-secondary/20 rounded-xl px-4 py-3 border border-border/10">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {adm.display_name || "Admin"}
                        {isMe && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">You</span>}
                        {adm.isPrimary && (
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5">
                            Owner
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{adm.email}</p>
                    </div>
                    
                    {!cannotRemove ? (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove Super Admin privileges from ${adm.display_name || adm.email}?`)) {
                            handleDemote(adm.id);
                          }
                        }}
                        disabled={demotingId === adm.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all disabled:opacity-50"
                      >
                        {demotingId === adm.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserMinus size={12} />
                        )}
                        Remove Admin
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                        <ShieldAlert size={12} className="text-muted-foreground/60" />
                        Non-removable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
