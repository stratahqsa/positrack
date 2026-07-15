import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/release-schedule → the PXB1 Phase 1 Release Schedule Tracker HTML,
 * proxied server-side from the machine-managed GitHub Release
 * `release-schedule-latest` (refreshed 3x/day by the Release Schedule workflow).
 *
 * Proxied rather than embedded directly via `<iframe src="https://github.com/...">`
 * because GitHub release-asset downloads may serve `Content-Disposition:
 * attachment` / `application/octet-stream`, which would make the browser try to
 * download the file instead of rendering it in the iframe. Fetching it here and
 * re-serving with an explicit `text/html` content type sidesteps that entirely,
 * and matches this app's only other pattern for external data (`web/lib/data.ts`:
 * server-side `fetch(..., {cache:"no-store"})` inside a force-dynamic boundary).
 */

const BASE =
  process.env.RELEASE_SCHEDULE_DATA_URL ??
  "https://github.com/stratahqsa/positrack/releases/download/release-schedule-latest";

function fallbackHtml(reason: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a;
    display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{max-width:32rem;padding:28px 32px;background:#fff;border:1px solid #e2e8f0;
    border-radius:10px;text-align:center}
  h1{font-size:15px;margin:0 0 8px}
  p{font-size:12.5px;color:#475569;line-height:1.6;margin:0}
</style></head><body>
  <div class="card">
    <h1>Report not yet available</h1>
    <p>The Release Schedule Tracker refreshes automatically at 9am, 12pm, and
    6pm IST. If this message persists past the next scheduled refresh, check the
    <b>Release Schedule</b> GitHub Actions workflow for errors.</p>
    <p style="margin-top:10px;color:#94a3b8">(${reason})</p>
  </div>
</body></html>`;
}

export async function GET() {
  try {
    const res = await fetch(`${BASE}/release-schedule.html`, { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(fallbackHtml(`upstream returned ${res.status}`), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return new NextResponse(fallbackHtml(message), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
