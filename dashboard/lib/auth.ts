/**
 * Access-gate primitives. Web Crypto (HMAC-SHA256) so the SAME code runs in
 * both the Edge middleware and Node route handlers. No external JWT dependency.
 *
 * The cookie value is `payload.signature` where:
 *   payload   = base64url(JSON({ v:1, iat, exp }))
 *   signature = base64url(HMAC-SHA256(payload, secret))
 * The secret is derived from ACCESS_CODE, so it never needs a second env var,
 * and a changed code invalidates every existing session.
 */

export const SESSION_COOKIE = "posx_ct_session";
/** Separate admin session — signed with ADMIN_CODE, so the viewer PIN can
 *  never mint it and rotating either code invalidates only its own sessions. */
export const ADMIN_COOKIE = "posx_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time-ish comparison over two base64url strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface SessionPayload {
  v: number;
  iat: number;
  exp: number;
}

/** Create a signed session token bound to the given secret (the access code). */
export async function createSessionToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Verify a session token against the secret. Returns true only if valid + unexpired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  try {
    const key = await hmacKey(secret);
    const expected = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payloadB64),
    );
    if (!safeEqual(sigB64, b64urlEncode(new Uint8Array(expected)))) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadB64)),
    ) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
}

/** Compare a user-entered code to ACCESS_CODE in constant-ish time. */
export function codeMatches(input: string, expected: string): boolean {
  if (!expected) return false;
  const a = encoder.encode(input);
  const b = encoder.encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
