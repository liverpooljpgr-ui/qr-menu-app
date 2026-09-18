"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own standalone flag
    (navigator as { standalone?: boolean }).standalone === true
  );
}

interface InstallPromptProps {
  // Branded prompt for a guest menu; without it, this is the generic admin
  // prompt and stays off /m/ so guests aren't offered the wrong app.
  appName?: string;
  // Persist dismissal across visits (guests shouldn't be nagged every scan).
  storageKey?: string;
}

function readDismissed(storageKey?: string) {
  if (!storageKey || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function InstallPrompt({ appName, storageKey }: InstallPromptProps = {}) {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(
    () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const [installed, setInstalled] = useState(
    () => typeof window === "undefined" || isStandalone()
  );
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  const dismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
    }
  };

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!appName && pathname.startsWith("/m/")) return null;
  if (installed || dismissed) return null;
  if (!installEvent && !isIOS) return null;

  async function handleInstallClick() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  const subject = appName ?? "this app";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-lg">
      {installEvent ? (
        <>
          <p className="text-sm">
            {appName
              ? `Add ${appName} to your home screen for quick access.`
              : "Install this app for quicker access."}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={handleInstallClick}>
              {appName ? "Add" : "Install"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {appName ? "Not now" : "Dismiss"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            Add {subject} to your home screen: tap <span aria-hidden>⎋</span>{" "}
            Share, then &ldquo;Add to Home Screen&rdquo;.
          </p>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {appName ? "Not now" : "Dismiss"}
          </Button>
        </>
      )}
    </div>
  );
}
