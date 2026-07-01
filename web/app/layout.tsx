import type { ReactNode } from "react";

export const metadata = {
  title: "POSX Control Tower",
  description: "PXB1 Beta Phase 1 — live project control tower",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b1120",
          color: "#e2e8f0",
        }}
      >
        {children}
      </body>
    </html>
  );
}
