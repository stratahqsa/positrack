import "server-only";

/**
 * Minimal GitHub Actions client for the snapshot workflow. GH's own `schedule:`
 * trigger drifts 1–3.5 h (measured Jul 2026), while workflow_dispatch runs
 * start within seconds — so the punctual path is Vercel Cron → our route →
 * these calls. Auth: GH_DISPATCH_TOKEN (fine-grained PAT, Actions r/w on
 * stratahqsa/positrack only).
 */
const REPO = "stratahqsa/positrack";
const WORKFLOW = "snapshot.yml";
const API = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) throw new Error("GH_DISPATCH_TOKEN is not set");
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
}

export async function dispatchSnapshot(): Promise<void> {
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ ref: "master" }),
    cache: "no-store",
  });
  if (res.status !== 204) {
    throw new Error(`workflow dispatch failed (${res.status}): ${await res.text()}`);
  }
}

export interface RunInfo {
  id: number;
  event: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | ... (null while running)
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function listSnapshotRuns(limit = 10): Promise<RunInfo[]> {
  const res = await fetch(
    `${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${limit}`,
    { headers: ghHeaders(), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`runs fetch failed (${res.status})`);
  const data = (await res.json()) as { workflow_runs?: RunInfo[] };
  return (data.workflow_runs ?? []).map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
  }));
}
