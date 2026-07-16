#!/usr/bin/env node
/**
 * Seed prior-day snapshot history from Vercel Blob BEFORE scripts/snapshot.py
 * runs, so build_insights() can compute the day-over-day RED delta. Replaces
 * the old GitHub-Release-based seeding now that the snapshot is Blob-only
 * (secret path). Every run is a fresh checkout with no local state, so the two
 * dated files snapshot.py needs are pulled from Blob here:
 *   1. The most recent PRIOR-day dated file  -> the delta baseline.
 *   2. TODAY's own dated file, if an earlier run today already published one
 *      -> so write_snapshot()'s freeze check sees it and doesn't re-freeze.
 *
 * BEST-EFFORT: any failure (token unset, list error, download error) just
 * means the delta shows "first snapshot / no prior data" this run. It is never
 * fatal -- the snapshot itself does not depend on the seed succeeding. Requires
 * BLOB_READ_WRITE_TOKEN (for list) + SNAPSHOT_SECRET (the path prefix).
 */
import { list } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";

const secret = process.env.SNAPSHOT_SECRET;
const DATA_DIR = "web/data";
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!secret) {
  console.log("SNAPSHOT_SECRET unset -- skipping seed; deltas begin once it is set");
  process.exit(0);
}
const prefix = `${secret.replace(/\/+$/, "")}/`;
const DATED = /^snapshot-(\d{4}-\d{2}-\d{2})\.json$/;

async function download(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  fs.writeFileSync(path.join(DATA_DIR, name), Buffer.from(await res.arrayBuffer()));
  console.log(`seeded ${name}`);
}

try {
  const { blobs } = await list({ prefix });
  const files = blobs
    .map((b) => {
      const name = b.pathname.slice(prefix.length);
      const m = name.match(DATED);
      return m ? { date: m[1], name, url: b.url } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = new Date().toISOString().slice(0, 10);
  const todays = files.find((f) => f.date === today);
  const prior = [...files].reverse().find((f) => f.date < today);

  if (todays) await download(todays.url, todays.name).catch((e) => console.log(`skip today: ${e.message}`));
  if (prior) await download(prior.url, prior.name).catch((e) => console.log(`skip prior: ${e.message}`));
  if (!todays && !prior) console.log("no prior snapshots under prefix yet -- deltas begin next run");
} catch (e) {
  console.log(`::warning::seed failed (${e.message}); deltas will show no prior data this run`);
}
