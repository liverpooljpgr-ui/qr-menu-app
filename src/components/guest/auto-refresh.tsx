"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the server-rendered menu when the page regains focus and on an
// interval, so a guest who keeps the menu open sees republished changes.
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    const id = setInterval(refresh, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
