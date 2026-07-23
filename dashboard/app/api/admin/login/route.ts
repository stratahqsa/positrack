import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  codeMatches,
  createSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/admin/login { code } → sets the ADMIN session cookie (separate
 * code + cookie from the viewer gate; see lib/auth.ts). Mirrors /api/login.
 */
export async function POST(req: NextRequest) {
  const adminCode = process.env.ADMIN_CODE;
  if (!adminCode) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CODE not configured on the server." },
      { status: 503 },
    );
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    try {
      const form = await req.formData();
      code = String(form.get("code") ?? "");
    } catch {
      code = "";
    }
  }

  if (!codeMatches(code.trim(), adminCode)) {
    return NextResponse.json(
      { ok: false, error: "Incorrect admin code." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(adminCode);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** DELETE /api/admin/login → clear the admin session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
