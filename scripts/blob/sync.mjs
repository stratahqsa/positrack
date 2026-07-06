#!/usr/bin/env node
// CI-only: sync the POSX Control Tower snapshot to/from Vercel Blob.
//
//   node sync.mjs push   upload web/data/latest.json + snapshot-<date>.json to Blob
//   node sync.mjs pull   seed the most recent PRIOR dated snapshot into web/data/
//                        so scripts/snapshot.py can compute day-over-day deltas
//                        (the runner has no committed history anymore)
//
// Requires BLOB_READ_WRITE_TOKEN in the environment (the same token Vercel injects
// into the Control Tower app). The engine never sees it; only this uploader does.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put, list } from "@vercel/blob";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, "..", "..", "web", "data");
const PREFIX = "control-tower/";
const DATED = /^snapshot-\d{4}-\d{2}-\d{2}\.json$/;

async function push() {
  const files = (await readdir(DATA_DIR)).filter(
    (f) => f === "latest.json" || DATED.test(f),
  );
  if (!files.length) throw new Error(`no snapshot json found in ${DATA_DIR}`);
  for (const f of files) {
    const body = await readFile(path.join(DATA_DIR, f));
    const { url } = await put(PREFIX + f, body, {
      access: "public", // Blob's only tier; the URL is unlisted and only ever used server-side
      addRandomSuffix: false, // stable pathname so latest.json overwrites in place
      allowOverwrite: true,
      contentType: "application/json",
    });
    console.log(`↑ ${f} -> ${url}`);
  }
}

async function pull() {
  await mkdir(DATA_DIR, { recursive: true });
  const { blobs } = await list({ prefix: `${PREFIX}snapshot-` });
  const prior = blobs
    .filter((b) => DATED.test(path.basename(b.pathname)))
    .sort((a, b) => b.pathname.localeCompare(a.pathname))[0]; // newest first
  if (!prior) {
    console.log("no prior snapshot in Blob (first run) — deltas begin next run");
    return;
  }
  const res = await fetch(prior.url);
  if (!res.ok) {
    console.log(`could not fetch prior (${res.status}); skipping delta seed`);
    return;
  }
  const name = path.basename(prior.pathname);
  await writeFile(path.join(DATA_DIR, name), Buffer.from(await res.arrayBuffer()));
  console.log(`↓ seeded prior ${name} for delta`);
}

const cmd = process.argv[2];
if (cmd === "push") await push();
else if (cmd === "pull") await pull();
else {
  console.error("usage: node sync.mjs push|pull");
  process.exit(1);
}
