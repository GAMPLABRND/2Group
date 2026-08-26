"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SessionTimeout({ minutes }: { minutes: number }) {
  const router = useRouter();
  useEffect(() => {
    const delay = Math.max(1, minutes) * 60 * 1000;
    const refreshInterval = 60 * 1000;
    let lastServerRefresh = 0;
    let timer = window.setTimeout(() => void expire(), delay);

    async function expire() {
      await fetch("/api/logout?reason=timeout", { method: "POST", cache: "no-store" }).catch(() => null);
      router.replace("/login");
      router.refresh();
    }

    function refresh() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void expire(), delay);
      const currentTime = Date.now();
      if (currentTime - lastServerRefresh >= refreshInterval) {
        lastServerRefresh = currentTime;
        void fetch("/api/session/refresh", { method: "POST", cache: "no-store" }).catch(() => null);
      }
    }

    const events: (keyof WindowEventMap)[] = ["click", "keydown", "pointerdown", "scroll"];
    refresh();
    for (const event of events) window.addEventListener(event, refresh, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, refresh);
    };
  }, [minutes, router]);

  return null;
}
