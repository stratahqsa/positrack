"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

/** Clears the session cookie (DELETE /api/login) and returns to /login. */
export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/login", { method: "DELETE" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-border-strong hover:text-fg disabled:opacity-60"
      aria-label="Sign out"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <LogOut className="size-3.5" />
      )}
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
