import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TzInit } from "@/components/shell/tz-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "POSX Reports",
  description: "PXB1 reports dashboard",
  robots: { index: false, follow: false },
};

/**
 * Runs before first paint to set the theme class on <html>, killing the
 * flash-of-wrong-theme. Order of preference: explicit saved choice in
 * localStorage ("posx-theme"), otherwise the OS `prefers-color-scheme`.
 * Kept as a string so it ships inline in <head> ahead of hydration.
 * The header's ThemeToggle keeps localStorage + the class in sync afterward.
 */
const THEME_INIT = `(function(){try{var s=localStorage.getItem("posx-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var c=document.documentElement.classList;c.remove("dark","light");c.add(d?"dark":"light");}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">
        {children}
        <TzInit />
      </body>
    </html>
  );
}
