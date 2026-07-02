import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  codeMatches,
  createSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/login  { code }  → validates against process.env.ACCESS_CODE
 * (server-side only) and, on success, sets an httpOnly signed session cookie.
 * The access code is never stored client-side; only the signed token is.
 */
export async function POST(req: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.json(
      { ok: false, error: "ACCESS_CODE not configured on the server." },
      { status: 503 },
    );
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    // Fall back to form-encoded submissions.
    try {
      const form = await req.formData();
      code = String(form.get("code") ?? "");
    } catch {
      code = "";
    }
  }

  if (!codeMatches(code.trim(), accessCode)) {
    return NextResponse.json(
      { ok: false, error: "Incorrect access code." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(accessCode);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** DELETE /api/login → clear the session (logout). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
