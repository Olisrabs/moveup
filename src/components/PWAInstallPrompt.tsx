"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, PlusSquare, Smartphone, Sparkles } from "lucide-react";

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if we are running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    // 2. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    }

    const isInstalled = checkStandalone();
    if (isInstalled) return;

    // 3. Detect iOS Device
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isAppleDevice);
      return isAppleDevice;
    };

    const iosDevice = detectIOS();

    // 4. Handle installation prompt event (Chrome, Edge, Samsung Internet, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default mini-infobar from appearing
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      // Save it globally on window so other components can access it (like settings page)
      (window as any).deferredPrompt = e;
      
      // Check if user dismissed it recently (e.g. within 3 days)
      const dismissedTime = localStorage.getItem("pwa_dismissed_time");
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const isRecentlyDismissed = dismissedTime && Date.now() - parseInt(dismissedTime) < threeDays;

      if (!isRecentlyDismissed) {
        // Delay showing the prompt for a premium entrance (2 seconds)
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Handle app installed event (fires when PWA is successfully installed)
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // 6. Fallback for iOS since beforeinstallprompt is not supported
    if (iosDevice) {
      const dismissedTime = localStorage.getItem("pwa_dismissed_time");
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      const isRecentlyDismissed = dismissedTime && Date.now() - parseInt(dismissedTime) < threeDays;

      if (!isRecentlyDismissed) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2000); // 2 seconds delay
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Hide our custom banner
    setShowPrompt(false);
    
    // Show the native browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    // Reset the deferred prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal time in localStorage to avoid showing it immediately again
    localStorage.setItem("pwa_dismissed_time", Date.now().toString());
  };

  // Do not render anything if already installed, or if not showing prompt
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl md:right-6 md:left-auto"
        >
          {/* Subtle Glow Effect behind icon */}
          <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            {/* App Icon Representation */}
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 p-2 shadow-inner border border-white/5">
              <svg viewBox="0 0 24 24" className="h-10 w-10 overflow-visible text-white">
                <circle cx="6" cy="18" r="4.5" stroke="url(#prompt-logo-grad)" strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="4.5" stroke="url(#prompt-logo-grad)" strokeWidth="1.5" fill="none" />
                <circle cx="18" cy="6" r="4.5" stroke="url(#prompt-logo-grad)" strokeWidth="1.5" fill="none" />
                <defs>
                  <linearGradient id="prompt-logo-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md">
                <Sparkles size={10} className="animate-pulse" />
              </div>
            </div>

            {/* Content info */}
            <div className="flex-1 pr-6">
              <h3 className="font-semibold text-white text-base leading-snug">
                Download MoveUp
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Add MoveUp to your home screen for faster loading, offline access, and a native app experience on your phone.
              </p>
            </div>
          </div>

          <hr className="my-4 border-white/5" />

          {/* Conditional UI based on Device Type */}
          {isIOS ? (
            <div className="flex flex-col gap-2 rounded-lg bg-slate-900/50 p-3 border border-white/5">
              <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Smartphone size={14} className="text-indigo-400" />
                iOS Installation Guide:
              </p>
              <ol className="text-[11px] text-slate-400 space-y-1.5 pl-1">
                <li className="flex items-center gap-2">
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">1</span>
                  <span>Tap the <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-white"><Share size={10} /> share button</span> at the bottom.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">2</span>
                  <span>Scroll down and select <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1 py-0.5 text-white"><PlusSquare size={10} /> Add to Home Screen</span>.</span>
                </li>
              </ol>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleDismiss}
                className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Not now
              </button>
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 active:scale-95 transition-all"
              >
                <Download size={14} />
                Install App
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
