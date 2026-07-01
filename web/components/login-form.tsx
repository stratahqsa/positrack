"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radar, KeyRound, Loader2, ArrowRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/") ? next : "/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Incorrect access code.");
      setLoading(false);
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-accent/12 ring-1 ring-accent/30">
          <Radar className="size-6 text-accent" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-fg">
          POSX Control Tower
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Enter the shared access code to continue.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-border bg-surface/60 p-5 card-ring backdrop-blur"
      >
        {!configured ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[12px] text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>ACCESS_CODE not configured</strong> on the server. Login is
              disabled until it is set.
            </span>
          </div>
        ) : null}

        <label
          htmlFor="code"
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-faint"
        >
          Access code
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            id="code"
            type="password"
            autoComplete="off"
            autoFocus
            value={code}
            disabled={!configured || loading}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••"
            className={cn(
              "w-full rounded-lg border bg-bg/60 py-2.5 pl-9 pr-3 text-[14px] text-fg outline-none transition-colors placeholder:text-faint",
              error
                ? "border-danger/50 focus:border-danger"
                : "border-border focus:border-accent/60",
              "focus:ring-2 focus:ring-accent/20 disabled:opacity-50",
            )}
          />
        </div>

        {error ? (
          <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={!configured || loading || !code.trim()}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg transition-all",
            "hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              Enter Control Tower
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
        Shared-code access for the beta. All project data is served only after
        this gate — nothing is exposed publicly.
      </p>
    </div>
  );
}
