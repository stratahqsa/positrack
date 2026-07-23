#!/usr/bin/env node
/**
 * Schedule gate for the GitHub `schedule:` FALLBACK trigger only (the workflow
 * skips this for workflow_dispatch — explicit intent always runs). Reads the
 * admin-managed schedule.json from the secret Blob path and decides whether
 * today's fallback should run: enabled, not paused, today's IST weekday on.
 * FAIL-OPEN: any fetch/parse problem lets the fallback run — a stale-data
 * outage is worse than one extra snapshot.
 *
 * Writes `run=true|false` to $GITHUB_OUTPUT (job output `gate.outputs.run`).
 */
import fs from "node:fs";
import { list } from "@vercel/blob";

function out(run, reason) {
  console.log(`gate: run=${run} — ${reason}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
  process.exit(0);
}

const secret = (process.env.SNAPSHOT_SECRET || "").replace(/\/+$/, "");
if (!secret || !process.env.BLOB_READ_WRITE_TOKEN) {
  out(true, "no blob credentials — fail-open");
}

try {
  const { blobs } = await list({ prefix: `${secret}/schedule.json` });
  const hit = blobs.find((b) => b.pathname === `${secret}/schedule.json`);
  if (!hit) out(true, "no schedule.json yet — fail-open");
  const res = await fetch(hit.url, { cache: "no-store" });
  const cfg = await res.json();
  if (cfg.enabled === false) out(false, "schedule disabled in the admin panel");
  const ist = new Date(Date.now() + 330 * 60_000);
  const date = ist.toISOString().slice(0, 10);
  if (typeof cfg.paused_until === "string" && date <= cfg.paused_until) {
    out(false, `paused until ${cfg.paused_until}`);
  }
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][ist.getUTCDay()];
  if (cfg.days && cfg.days[day] === false) out(false, `${day} disabled`);
  out(true, "fallback due");
} catch (e) {
  out(true, `gate error (${e && e.message}) — fail-open`);
}
