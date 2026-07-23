"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarOff,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEFAULT_SCHEDULE, parseSlot, type ScheduleConfig } from "@/lib/schedule-rules";
import type { RunInfo } from "@/lib/github";
import { fmtDateTime } from "@/lib/format";

const DAY_LABELS: [keyof ScheduleConfig["days"], string][] = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

/**
 * The /admin control surface: schedule editor (days + IST slots + pause),
 * debounced Refresh Now, and recent-run history. State is plain local React
 * state — Save PUTs the whole config; the cron tick reads it on its next
 * 15-min pass, so changes need no deploy and no restart.
 */
export function AdminPanel({
  initial,
  runs,
  runsError,
  tz,
}: {
  initial: ScheduleConfig;
  runs: RunInfo[];
  runsError: string | null;
  tz: string;
}) {
  const router = useRouter();
  const [cfg, setCfg] = React.useState<ScheduleConfig>(initial);
  const [newSlot, setNewSlot] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshMsg, setRefreshMsg] = React.useState<string | null>(null);

  function addSlot() {
    const m = parseSlot(newSlot);
    if (m === null) {
      setSavedMsg("Invalid time — use HH:MM (24h, IST)");
      return;
    }
    const canon = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (!cfg.slots_ist.includes(canon)) {
      setCfg({
        ...cfg,
        slots_ist: [...cfg.slots_ist, canon].sort((a, b) => parseSlot(a)! - parseSlot(b)!),
      });
    }
    setNewSlot("");
    setSavedMsg(null);
  }

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json().catch(() => ({}));
      setSavedMsg(
        res.ok ? "Saved — takes effect on the next 15-min tick." : data?.error || "Save failed",
      );
      if (res.ok && data?.config) setCfg(data.config);
    } catch {
      setSavedMsg("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshNow() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setRefreshMsg(data?.error || "Trigger failed");
      else if (data.action === "dispatched")
        setRefreshMsg("Refresh started — new data lands in ~2-3 minutes.");
      else if (data.action === "already-running")
        setRefreshMsg("A refresh is already running — hang tight.");
      else setRefreshMsg("A refresh finished under 15 minutes ago — data is fresh.");
      router.refresh();
    } catch {
      setRefreshMsg("Network error — try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ---- Refresh now ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-accent" /> Refresh now
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[12.5px] text-muted">
            Triggers a full snapshot immediately (finishes in ~2–3 min). Guarded: won&apos;t
            double-fire if a run is active or just finished.
          </p>
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2",
              "text-[13px] font-semibold text-bg transition hover:opacity-90",
              refreshing && "opacity-60",
            )}
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Refresh data now
          </button>
          {refreshMsg ? <p className="text-[12.5px] text-fg/90">{refreshMsg}</p> : null}
        </CardContent>
      </Card>

      {/* ---- Run history ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-accent" /> Recent refresh runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsError ? (
            <p className="text-[12.5px] text-muted">Run history unavailable ({runsError}).</p>
          ) : runs.length === 0 ? (
            <p className="text-[12.5px] text-faint">No runs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-faint">
                  <tr>
                    <th className="pb-1 font-medium">Started</th>
                    <th className="pb-1 font-medium">Trigger</th>
                    <th className="pb-1 font-medium">Status</th>
                    <th className="pb-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-1.5 tabular whitespace-nowrap">
                        {fmtDateTime(new Date(r.created_at).getTime(), tz)}
                      </td>
                      <td className="py-1.5">
                        {r.event === "workflow_dispatch" ? "manual / cron" : "fallback"}
                      </td>
                      <td className="py-1.5">
                        <Badge
                          variant={
                            r.status !== "completed"
                              ? "info"
                              : r.conclusion === "success"
                                ? "good"
                                : "danger"
                          }
                        >
                          {r.status !== "completed" ? r.status : (r.conclusion ?? "?")}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-right">
                        <a
                          href={r.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-faint transition hover:text-fg"
                          aria-label="Open run on GitHub"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Schedule editor ---- */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-4 text-accent" /> Refresh schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-[13px] text-fg">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            />
            Scheduled refreshes enabled
          </label>

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted">Days (IST)</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    setCfg({ ...cfg, days: { ...cfg.days, [key]: !cfg.days[key] } })
                  }
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] font-medium transition",
                    cfg.days[key]
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-border bg-surface text-faint line-through",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted">
              Refresh times (IST) — each run takes ~2–3 min
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {cfg.slots_ist.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] tabular text-fg"
                >
                  {s}
                  <button
                    onClick={() =>
                      setCfg({ ...cfg, slots_ist: cfg.slots_ist.filter((x) => x !== s) })
                    }
                    aria-label={`Remove ${s}`}
                    className="text-faint hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSlot()}
                placeholder="HH:MM"
                className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] tabular text-fg placeholder:text-faint"
              />
              <button
                onClick={addSlot}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:text-fg"
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[12px] font-medium text-muted" htmlFor="pause">
              Pause until (inclusive, IST date)
            </label>
            <input
              id="pause"
              type="date"
              value={cfg.paused_until ?? ""}
              onChange={(e) => setCfg({ ...cfg, paused_until: e.target.value || null })}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] text-fg"
            />
            {cfg.paused_until ? (
              <button
                onClick={() => setCfg({ ...cfg, paused_until: null })}
                className="text-[12px] text-accent hover:underline"
              >
                clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            <button
              onClick={save}
              disabled={saving || cfg.slots_ist.length === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2",
                "text-[13px] font-semibold text-bg transition hover:opacity-90",
                (saving || cfg.slots_ist.length === 0) && "opacity-60",
              )}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save schedule
            </button>
            <button
              onClick={() => setCfg(DEFAULT_SCHEDULE)}
              className="text-[12.5px] text-muted hover:text-fg"
            >
              Reset to defaults
            </button>
            {savedMsg ? <span className="text-[12.5px] text-fg/90">{savedMsg}</span> : null}
          </div>
          <p className="text-[11.5px] text-faint">
            A nightly 5am IST fallback run also respects these settings. Manual triggers (this
            page&apos;s button or the GitHub UI) always run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
