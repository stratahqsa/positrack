import { NextResponse, type NextRequest } from "next/server";
import { readSchedule, writeSchedule } from "@/lib/schedule-config";
import { normalizeSchedule } from "@/lib/schedule-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → current schedule config; PUT → validate + persist. Auth: middleware
 *  requires the admin session for every /api/admin/* path; this 503s when the
 *  gate itself is unconfigured so nothing silently writes unprotected. */
export async function GET() {
  if (!process.env.ADMIN_CODE) {
    return NextResponse.json({ ok: false, error: "ADMIN_CODE not configured" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, config: await readSchedule() });
}

export async function PUT(req: NextRequest) {
  if (!process.env.ADMIN_CODE) {
    return NextResponse.json({ ok: false, error: "ADMIN_CODE not configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const cfg = normalizeSchedule(body);
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "invalid schedule (need ≥1 valid HH:MM slot)" },
      { status: 400 },
    );
  }
  try {
    await writeSchedule(cfg);
    return NextResponse.json({ ok: true, config: cfg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
