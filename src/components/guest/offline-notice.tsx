"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// savedAt is the server render time baked into the HTML, so for a cached page
// it is exactly when that copy was saved. A fresh render changes it, which
// clears the cache flag without needing an effect.
export function OfflineNotice({ savedAt }: { savedAt: string }) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const [cachedSavedAt, setCachedSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "served-from-cache" && event.data.value) {
        setCachedSavedAt(savedAt);
      }
    };
    sw.addEventListener("message", onMessage);
    sw.controller.postMessage({ type: "served-from-cache?" });
    return () => sw.removeEventListener("message", onMessage);
  }, [savedAt]);

  const servedFromCache = cachedSavedAt !== null && cachedSavedAt === savedAt;
  if (online && !servedFromCache) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 bg-amber-50 text-amber-900 border-b border-amber-200 px-4 py-3 text-sm"
    >
      <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p>
        You&apos;re offline. This is the last saved version of the menu, from{" "}
        {new Date(savedAt).toLocaleString()}. It will update when you&apos;re
        back online.
      </p>
    </div>
  );
}
