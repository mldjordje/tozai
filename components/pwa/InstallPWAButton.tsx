"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// Chrome/Edge/Android fire this instead of navigating away; we stash it and
// trigger the native install prompt later, from our own button.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag — not covered by the display-mode media query.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallPWAButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* installability is best-effort — a failed SW registration shouldn't break the page */
      });
    }

    setInstalled(isStandalone());
    setIos(isIos());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  const buttonClass = `inline-flex items-center gap-1.5 ${
    className ||
    "rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
  }`;

  if (prompt) {
    return (
      <button type="button" onClick={install} className={buttonClass}>
        <Download size={14} strokeWidth={1.75} aria-hidden />
        Instaliraj aplikaciju
      </button>
    );
  }

  if (ios) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowIosHelp((v) => !v)}
          className={buttonClass}
        >
          <Download size={14} strokeWidth={1.75} aria-hidden />
          Instaliraj aplikaciju
        </button>
        {showIosHelp && (
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-bg-elev p-4 text-xs text-fg shadow-xl">
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              aria-label="Zatvori"
              className="absolute right-2 top-2 text-faint hover:text-fg"
            >
              <X size={14} />
            </button>
            <p className="mb-2 flex items-center gap-1.5 font-medium">
              <Share size={14} strokeWidth={1.75} aria-hidden />
              Instalacija na iPhone/iPad
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-faint">
              <li>Tapni ikonicu Podeli (kvadrat sa strelicom) u Safari traci.</li>
              <li>Izaberi &ldquo;Dodaj na početni ekran&rdquo; (Add to Home Screen).</li>
              <li>Potvrdi tapom na &ldquo;Dodaj&rdquo;.</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return null;
}
