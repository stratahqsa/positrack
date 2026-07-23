/**
 * Per-BROWSER timezone preference (the access PIN is shared, so this must
 * never be global): a `posx_tz` cookie holds the explicit choice (or "auto"),
 * and `posx_tz_detected` carries the browser's own IANA zone (written by
 * TzInit) so the SERVER can render "auto" correctly. Pages are force-dynamic,
 * so cookie-driven SSR means no hydration mismatch and no client reformatting.
 * Pure module — imported by both server code and client components.
 */
export const TZ_COOKIE = "posx_tz";
export const TZ_DETECTED_COOKIE = "posx_tz_detected";
export const IST = "Asia/Kolkata";
export const SAST = "Africa/Johannesburg";
export type TzPref = "auto" | typeof IST | typeof SAST;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Effective IANA zone from (preference cookie, detected cookie). IST fallback. */
export function resolveTz(pref: string | undefined, detected: string | undefined): string {
  if (pref === IST || pref === SAST) return pref;
  if (detected && isValidTimeZone(detected)) return detected;
  return IST;
}
