import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin sign in · POSX Reports",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  const configured = !!process.env.ADMIN_CODE;

  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <AdminLoginForm configured={configured} />
    </main>
  );
}
