import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in · POSX Control Tower",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const configured = !!process.env.ACCESS_CODE;

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
        <LoginForm configured={configured} />
      </Suspense>
    </main>
  );
}
