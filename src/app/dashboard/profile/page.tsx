"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Mail,
  Building2,
  Shield,
  Users,
  ChevronRight,
  Check,
  X,
  Plus,
  Loader2,
  Crown,
  BadgeCheck,
  LogOut,
  UserMinus,
  Smartphone,
  Download,
  Share,
  PlusSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type StaffInvitation } from "@/lib/supabase";
import { roleLabel, roleBadgeClass } from "@/lib/roles";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

export default function ProfilePage() {
  const { user, profile, refreshProfile, isSuperAdmin, isPartner, isObserver, signOut } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // PWA States
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Edit state
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Staff invite
  const [staffEmail, setStaffEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  // My staff list
  const [myStaff, setMyStaff] = useState<StaffInvitation[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Pending invitations (for this user if they're a staff candidate)
  const [pendingInvites, setPendingInvites] = useState<StaffInvitation[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  // Fetch staff and invitations
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingStaff(true);
      const [staffRes, invitesRes] = await Promise.all([
        // Staff I manage (as partner/super_admin)
        supabase
          .from("staff_invitations")
          .select("*, staff_user:staff_user_id(display_name, email)")
          .eq("partner_id", user.id)
          .order("created_at", { ascending: false }),
        // Invitations sent TO me
        supabase
          .from("staff_invitations")
          .select("*, partner:partner_id(display_name, business_name)")
          .eq("staff_user_id", user.id)
          .eq("status", "pending"),
      ]);
      setMyStaff((staffRes.data ?? []) as unknown as StaffInvitation[]);
      setPendingInvites((invitesRes.data ?? []) as unknown as StaffInvitation[]);
      setLoadingStaff(false);
    };

    fetchData();
  }, [user, inviteMsg]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from("users")
      .update({ display_name: displayName.trim(), phone: phone.trim() })
      .eq("id", user.id);

    if (error) {
      setSaveMsg("Failed to save. Please try again.");
    } else {
      await refreshProfile();
      setSaveMsg("Profile updated successfully!");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const handleInviteStaff = async () => {
    if (!staffEmail.trim() || !user) return;
    setInviting(true);
    setInviteMsg(null);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const res = await fetch("/api/partner/invite-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ staffEmail: staffEmail.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setInviteMsg("✅ Invitation sent successfully!");
      setStaffEmail("");
    } else {
      setInviteMsg(`❌ ${data.error}`);
    }
    setInviting(false);
    setTimeout(() => setInviteMsg(null), 5000);
  };

  const handleRespondToInvite = async (invitationId: string, action: "accept" | "reject") => {
    setRespondingId(invitationId);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const res = await fetch("/api/partner/staff-respond", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invitationId, action }),
    });
    const data = await res.json();

    if (res.ok) {
      await refreshProfile();
      setPendingInvites((prev) => prev.filter((i) => i.id !== invitationId));
    } else {
      alert(data.error ?? "Failed to respond");
    }
    setRespondingId(null);
  };

  const handleRemoveStaff = async (invitationId: string) => {
    if (!confirm("Are you sure you want to remove this staff member / revoke invitation?")) return;
    setRemovingId(invitationId);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const res = await fetch("/api/partner/remove-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invitationId }),
    });
    const data = await res.json();

    if (res.ok) {
      setMyStaff((prev) => prev.filter((i) => i.id !== invitationId));
    } else {
      alert(data.error ?? "Failed to remove staff");
    }
    setRemovingId(null);
  };

  useEffect(() => {
    // 1. Detect standalone
    const isStandaloneMode = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    
    setIsStandalone(isStandaloneMode);

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 3. Get global prompt if available
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // 4. Listen for prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 5. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handlePWAInstall = async () => {
    const prompt = deferredPrompt || (window as any).deferredPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      console.log("Install outcome:", outcome);
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
        setIsStandalone(true);
      }
    } else {
      alert("Installation is supported via your browser menu. Please tap the menu button (usually three dots ⋮ at the top right) and select 'Install app' or 'Add to Home screen'.");
    }
  };

  if (!profile) return null;

  const statusColor = {
    accepted: "text-emerald-400 bg-emerald-500/10",
    rejected: "text-red-400 bg-red-500/10",
    pending: "text-amber-400 bg-amber-500/10",
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-extrabold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal details and account settings.</p>
      </motion.div>

      {/* Role Badge */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${roleBadgeClass(profile.role)}`}>
          {profile.role === "super_admin" && <Crown size={14} />}
          {profile.role === "partner" && <Building2 size={14} />}
          {profile.role === "staff" && <BadgeCheck size={14} />}
          {roleLabel(profile.role)}
          {profile.business_name && ` — ${profile.business_name}`}
        </div>
        {profile.partnership_expires_at && (
          <p className="text-xs text-muted-foreground mt-1 ml-1">
            Partnership active until {new Date(profile.partnership_expires_at).toLocaleDateString()}
          </p>
        )}
      </motion.div>

      {/* Pending staff invitations */}
      {pendingInvites.length > 0 && (
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="glass-card rounded-2xl p-6 border border-amber-500/30">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Users size={18} className="text-amber-400" />
            Staff Invitations
          </h2>
          <div className="space-y-3">
            {pendingInvites.map((inv) => (
              <div key={inv.id}
                className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {(inv.partner as any)?.business_name ?? (inv.partner as any)?.display_name ?? "A Partner"}
                  </p>
                  <p className="text-xs text-muted-foreground">Invited you to be their Staff member</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondToInvite(inv.id, "accept")}
                    disabled={respondingId === inv.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors"
                  >
                    {respondingId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondToInvite(inv.id, "reject")}
                    disabled={respondingId === inv.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Personal Details */}
      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <User size={18} className="text-primary" />
          Personal Details
        </h2>
        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Your name"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Email Address
            </label>
            <div className="flex items-center gap-3 bg-secondary/30 border border-border rounded-xl px-4 py-3">
              <Mail size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{profile.email}</span>
              <span className="ml-auto text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">Read-only</span>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Phone Number
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="+234 800 000 0000"
              />
            </div>
          </div>

          {/* Member since */}
          <div className="text-xs text-muted-foreground">
            Member since {new Date(profile.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
          </div>

          {saveMsg && (
            <p className={`text-sm ${saveMsg.startsWith("Failed") ? "text-red-400" : "text-emerald-400"}`}>
              {saveMsg}
            </p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* For Partners — only shown if user is NOT yet a partner or super_admin */}
      {!isObserver && (
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show"
          className="glass-card rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-500/20 text-purple-400 p-2.5 rounded-xl">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-lg">For Partners</h2>
                <p className="text-xs text-muted-foreground">Have a partnership code? Activate it here.</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            If you are a tech academy, bootcamp, or organization partnering with MoveUp, enter your
            business name and the unique code provided to you to unlock partner features.
          </p>
          <Link
            href="/dashboard/profile/activate-partner"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Shield size={14} />
            Activate Partnership
            <ChevronRight size={14} />
          </Link>
        </motion.div>
      )}

      {/* Add Staff (Partner / Super Admin only) */}
      {isPartner && (
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
          className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
            <Users size={18} className="text-primary" />
            Add Staff
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Invite registered MoveUp users to be your staff members. They&apos;ll be able to monitor rooms without paying commitment fees.
          </p>
          <div className="flex gap-3">
            <input
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="staff@example.com"
              type="email"
            />
            <button
              onClick={handleInviteStaff}
              disabled={inviting || !staffEmail.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Invite
            </button>
          </div>
          {inviteMsg && (
            <p className={`text-sm mt-3 ${inviteMsg.startsWith("❌") ? "text-red-400" : "text-emerald-400"}`}>
              {inviteMsg}
            </p>
          )}

          {/* Staff list */}
          {loadingStaff ? (
            <div className="mt-6 space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-secondary/40 animate-pulse" />)}
            </div>
          ) : myStaff.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">My Staff ({myStaff.length})</p>
              {myStaff.map((inv) => (
                <div key={inv.id}
                  className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {(inv.staff_user as any)?.display_name ?? inv.staff_email}
                    </p>
                    <p className="text-xs text-muted-foreground">{inv.staff_email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[inv.status]}`}>
                      {inv.status}
                    </span>
                    <button
                      onClick={() => handleRemoveStaff(inv.id)}
                      disabled={removingId === inv.id}
                      className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                      title={inv.status === "pending" ? "Cancel invitation" : "Remove staff"}
                    >
                      {removingId === inv.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserMinus size={14} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Super Admin Panel Link */}
      {isSuperAdmin && (
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="glass-card rounded-2xl p-6 border border-amber-500/20">
          <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            Super Admin Controls
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manage partnership codes, monitor all partners and staff, process withdrawals, and promote other admins.
          </p>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Crown size={14} />
            Go to Admin Panel
            <ChevronRight size={14} />
          </Link>
        </motion.div>
      )}

      {/* Mobile Web App Download Settings */}
      <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6 border border-indigo-500/20 bg-slate-900/40">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-500/20 text-indigo-400 p-2.5 rounded-xl">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">MoveUp Web App</h2>
              <p className="text-xs text-muted-foreground">Install the application on your phone or desktop.</p>
            </div>
          </div>
        </div>

        {isStandalone ? (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400">
            <BadgeCheck size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold">Application Installed</p>
              <p className="text-xs text-emerald-500/80">You are currently running the official standalone MoveUp app.</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Get the native app experience directly on your device. Enjoy fullscreen browsing, faster load speeds, and easier access from your home screen.
            </p>
            {isIOS ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowIOSInstructions(!showIOSInstructions)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                  <Download size={14} />
                  {showIOSInstructions ? "Hide Instructions" : "How to Install on iOS"}
                </button>
                {showIOSInstructions && (
                  <div className="flex flex-col gap-2 rounded-xl bg-slate-900/50 p-4 border border-white/5 mt-3">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Smartphone size={14} className="text-indigo-400" />
                      iOS Safari Installation Steps:
                    </p>
                    <ol className="text-xs text-slate-400 space-y-2 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">1</span>
                        <span>Tap the <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-white font-medium"><Share size={11} /> Share button</span> in the bottom toolbar of Safari.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">2</span>
                        <span>Scroll down the share sheet and select <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1 py-0.5 text-white font-medium"><PlusSquare size={11} /> Add to Home Screen</span>.</span>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handlePWAInstall}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all active:scale-95"
              >
                <Download size={14} />
                Install Web App
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Logout */}
      <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show"
        className="glass-card rounded-2xl p-6 border border-red-500/20">
        <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
          <LogOut size={18} className="text-red-400" />
          Sign Out
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          You&apos;ll be returned to the home page and will need to sign in again to access your dashboard.
        </p>
        <button
          onClick={async () => {
            setLoggingOut(true);
            await signOut();
            router.push("/");
          }}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
        >
          {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </motion.div>
    </div>
  );
}
