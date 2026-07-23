import { NextResponse } from "next/server";
import { listSnapshotRuns } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → the last 10 snapshot workflow runs for the admin panel's history.
 *  Auth: middleware gates /api/admin/*. */
export async function GET() {
  if (!process.env.ADMIN_CODE) {
    return NextResponse.json({ ok: false, error: "ADMIN_CODE not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json({ ok: true, runs: await listSnapshotRuns(10) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
