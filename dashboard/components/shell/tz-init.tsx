"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_DETECTED_COOKIE } from "@/lib/tz";

/**
 * Writes the browser's detected IANA zone to a cookie so the SERVER renders
 * "auto" timestamps in the viewer's zone. One router.refresh() the first time
 * the value appears/changes — pages are force-dynamic, so the refresh
 * re-renders with the cookie applied (no full reload, no flicker loop).
 */
export function TzInit() {
  const router = useRouter();
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${TZ_DETECTED_COOKIE}=`))
        ?.split("=")[1];
      if (decodeURIComponent(current ?? "") !== detected) {
        document.cookie = `${TZ_DETECTED_COOKIE}=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
    } catch {
      /* IST fallback keeps working */
    }
  }, [router]);
  return null;
}
