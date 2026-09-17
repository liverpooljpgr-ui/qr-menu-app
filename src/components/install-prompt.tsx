"use client";

import { useEffect, useState } from "react";
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

export function InstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(
    () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const [installed, setInstalled] = useState(
    () => typeof window === "undefined" || isStandalone()
  );
  const [dismissed, setDismissed] = useState(false);

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

  if (installed || dismissed) return null;
  if (!installEvent && !isIOS) return null;

  async function handleInstallClick() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-lg">
      {installEvent ? (
        <>
          <p className="text-sm">Install this app for quicker access.</p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={handleInstallClick}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            Install this app: tap <span aria-hidden>⎋</span> Share, then
            &ldquo;Add to Home Screen&rdquo;.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </>
      )}
    </div>
  );
}
