import { NextResponse, type NextRequest } from "next/server";
import { readSchedule } from "@/lib/schedule-config";
import { dueSlot } from "@/lib/schedule-rules";
import { dispatchSnapshot } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Vercel Cron TICK (every 15 min — vercel.json). Consults the
 * admin-managed schedule and dispatches the GitHub snapshot workflow when an
 * IST slot falls inside this tick's window; otherwise a cheap no-op. Auth:
 * Vercel injects `Authorization: Bearer ${CRON_SECRET}` on cron invocations.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const cfg = await readSchedule();
  const slot = dueSlot(cfg, Date.now());
  if (!slot) {
    return NextResponse.json({
      ok: true,
      action: "no-op",
      reason: !cfg.enabled ? "disabled" : "no slot due in this window",
    });
  }
  try {
    await dispatchSnapshot();
    console.log(`cron/refresh: dispatched snapshot for IST slot ${slot}`);
    return NextResponse.json({ ok: true, action: "dispatched", slot });
  } catch (e) {
    console.error("cron/refresh: dispatch failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
