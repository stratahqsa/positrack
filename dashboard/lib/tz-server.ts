import "server-only";
import { cookies } from "next/headers";
import { IST, SAST, TZ_COOKIE, TZ_DETECTED_COOKIE, resolveTz, type TzPref } from "./tz";

/** The resolved IANA zone for this request (cookie-driven; IST fallback). */
export async function currentTz(): Promise<string> {
  const c = await cookies();
  return resolveTz(c.get(TZ_COOKIE)?.value, c.get(TZ_DETECTED_COOKIE)?.value);
}

/** The raw preference ("auto" unless explicitly IST/SAST) for the toggle UI. */
export async function currentTzPref(): Promise<TzPref> {
  const c = await cookies();
  const v = c.get(TZ_COOKIE)?.value;
  return v === IST || v === SAST ? v : "auto";
}
