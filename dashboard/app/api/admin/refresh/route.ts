import { NextResponse } from "next/server";
import { dispatchSnapshot, listSnapshotRuns } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_MS = 15 * 60_000;

/** POST → dispatch a snapshot run now, UNLESS one is already running or
 *  finished <15 min ago (returns that instead — keeps a shared button from
 *  hammering YouTrack). Manual GitHub-UI dispatch stays available regardless.
 *  Auth: middleware gates /api/admin/*. */
export async function POST() {
  if (!process.env.ADMIN_CODE) {
    return NextResponse.json({ ok: false, error: "ADMIN_CODE not configured" }, { status: 503 });
  }
  try {
    const [latest] = await listSnapshotRuns(1);
    if (latest && (latest.status === "queued" || latest.status === "in_progress")) {
      return NextResponse.json({ ok: true, action: "already-running", run: latest });
    }
    if (latest && Date.now() - new Date(latest.created_at).getTime() < RECENT_MS) {
      return NextResponse.json({ ok: true, action: "recently-completed", run: latest });
    }
    await dispatchSnapshot();
    return NextResponse.json({ ok: true, action: "dispatched" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
