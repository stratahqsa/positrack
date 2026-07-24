import "server-only";
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { DEFAULT_SCHEDULE, normalizeSchedule, type ScheduleConfig } from "./schedule-rules";

/**
 * schedule.json lives beside the snapshot in the SECRET Blob path (same
 * unguessable-prefix posture — see lib/data.ts). Reads use the public URL via
 * SNAPSHOT_DATA_URL; writes need BLOB_READ_WRITE_TOKEN (store connected to the
 * Vercel project). Dev without SNAPSHOT_DATA_URL falls back to
 * dashboard/data/schedule.json, mirroring loadSnapshot()'s local-file pattern.
 */
const BASE = process.env.SNAPSHOT_DATA_URL;

function localPath(): string {
  return path.join(process.cwd(), "data", "schedule.json");
}

/** The Blob pathname — the secret prefix is SNAPSHOT_DATA_URL's path part. */
function blobPathname(): string | null {
  if (!BASE) return null;
  try {
    const prefix = new URL(BASE).pathname.replace(/^\/+|\/+$/g, "");
    return prefix ? `${prefix}/schedule.json` : null;
  } catch {
    return null;
  }
}

export async function readSchedule(): Promise<ScheduleConfig> {
  if (!BASE) {
    try {
      if (fs.existsSync(localPath())) {
        return (
          normalizeSchedule(JSON.parse(fs.readFileSync(localPath(), "utf-8"))) ??
          DEFAULT_SCHEDULE
        );
      }
    } catch {
      /* fall through to defaults */
    }
    return DEFAULT_SCHEDULE;
  }
  try {
    const res = await fetch(`${BASE}/schedule.json`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_SCHEDULE; // not created yet → seeded defaults
    return normalizeSchedule(await res.json()) ?? DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function writeSchedule(cfg: ScheduleConfig, updatedBy = "admin"): Promise<void> {
  const body = JSON.stringify(
    { ...cfg, updated_at: new Date().toISOString(), updated_by: updatedBy },
    null,
    1,
  );
  const pathname = blobPathname();
  if (!pathname) {
    fs.mkdirSync(path.dirname(localPath()), { recursive: true });
    fs.writeFileSync(localPath(), body);
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — connect the Blob store to this Vercel project.",
    );
  }
  await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
}
