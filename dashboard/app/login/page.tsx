import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in · POSX Reports",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const configured = !!process.env.ACCESS_CODE;

  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
        <LoginForm configured={configured} />
      </Suspense>
    </main>
  );
}
