#!/usr/bin/env node
/**
 * Publish the freshly-produced snapshot to Vercel Blob under a SECRET path
 * prefix, so the raw JSON (which still contains real names in its assignee /
 * people fields) is NOT readable at a guessable public URL. The dashboard
 * reads it via SNAPSHOT_DATA_URL = <blob-base>/<SNAPSHOT_SECRET>.
 *
 * The Blob store itself is still a PUBLIC store (its access mode is immutable
 * once created), so this is defence-by-unguessable-path, not true private
 * ACLs -- a deliberate "secret-path interim". A leaked URL stays valid; the
 * proper fix is a private Blob store read via the SDK (a later follow-up).
 *
 * Publishes latest.json (overwritten every run) plus today's dated history
 * file (frozen on the first run of each UTC day by scripts/snapshot.py; prior
 * days already live in Blob from earlier runs). Those dated files are what the
 * day-over-day RED delta seeds from on the next run (see scripts/blob_seed.mjs).
 *
 * Requires BLOB_READ_WRITE_TOKEN + SNAPSHOT_SECRET in the environment. A put
 * failure exits non-zero (fails the job) on purpose: Blob is now the ONLY
 * delivery path (the public GitHub Release was dropped), so a silent failure
 * would strand the dashboard on stale data.
 */
import { put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";

const secret = process.env.SNAPSHOT_SECRET;
if (!secret) {
  console.error("SNAPSHOT_SECRET is required");
  process.exit(1);
}
const prefix = `${secret.replace(/\/+$/, "")}/`;
const DATA_DIR = "web/data";

async function publish(name) {
  const r = await put(`${prefix}${name}`, fs.readFileSync(path.join(DATA_DIR, name)), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
  console.log(`published ${name}`);
  return r.url;
}

const latestUrl = await publish("latest.json");

// Today's dated file (frozen history for tomorrow's delta seed). Prior days
// already persist in Blob from earlier runs, so we don't re-upload them.
const today = new Date().toISOString().slice(0, 10);
const todayName = `snapshot-${today}.json`;
if (fs.existsSync(path.join(DATA_DIR, todayName))) {
  await publish(todayName);
}

// Handy for configuring the dashboard: the value SNAPSHOT_DATA_URL should hold
// (the published latest.json URL minus the trailing /latest.json).
console.log("SNAPSHOT_DATA_URL base:", latestUrl.replace(/\/latest\.json$/, ""));
