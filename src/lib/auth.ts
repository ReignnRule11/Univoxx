import { SignJWT, jwtVerify } from "jose";
import { getConfig } from "./config";
import { unauthorized } from "./errors";
import { getClientIp } from "./security";
import { requireActiveUser } from "@/modules/identity/authorization";
import { getIdentityStore } from "@/modules/identity/store";
import type { SessionRecord, UserRecord } from "@/modules/identity/types";

export const ACCESS_COOKIE = "univox_access";
export const REFRESH_COOKIE = "univox_refresh";
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionClaims = {
  sub: string;
  email: string;
  sid: string;
};

export type AuthContext = {
  user: UserRecord;
  session: SessionRecord;
  claims: SessionClaims;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getConfig().AUTH_SECRET);
}

export async function signSession(claims: SessionClaims, expiresIn = `${ACCESS_TTL_SECONDS}s`): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(claims.sid)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.sid !== "string") {
      throw unauthorized("Invalid session");
    }
    return { sub: payload.sub, email: payload.email, sid: payload.sid };
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") {
      throw error;
    }
    throw unauthorized("Invalid or expired session");
  }
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function readAccessToken(request: Request): string | null {
  return readBearerToken(request) ?? readCookie(request, ACCESS_COOKIE);
}

export function readRefreshToken(request: Request): string | null {
  return readCookie(request, REFRESH_COOKIE);
}

export function cookieOptions(maxAge: number, httpOnly = true): string {
  const config = getConfig();
  const parts = [
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (httpOnly) {
    parts.push("HttpOnly");
  }
  if (config.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function setAuthCookies(headers: Headers, accessToken: string, refreshToken: string): void {
  headers.append("Set-Cookie", `${ACCESS_COOKIE}=${accessToken}; ${cookieOptions(ACCESS_TTL_SECONDS)}`);
  headers.append("Set-Cookie", `${REFRESH_COOKIE}=${refreshToken}; ${cookieOptions(REFRESH_TTL_SECONDS)}`);
}

export function clearAuthCookies(headers: Headers): void {
  headers.append("Set-Cookie", `${ACCESS_COOKIE}=; ${cookieOptions(0)}`);
  headers.append("Set-Cookie", `${REFRESH_COOKIE}=; ${cookieOptions(0)}`);
}

export async function requireSession(request: Request): Promise<SessionClaims> {
  const token = readAccessToken(request);
  if (!token) {
    throw unauthorized();
  }
  return verifySession(token);
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const claims = await requireSession(request);
  const store = getIdentityStore();
  const session = await store.findSessionById(claims.sid);
  if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("Session is no longer valid");
  }
  const user = await requireActiveUser(claims.sub);
  return { user, session, claims };
}

export function requestMeta(request: Request): { ip: string; userAgent: string | null } {
  const config = getConfig();
  return {
    ip: getClientIp(request, config.TRUST_PROXY),
    userAgent: request.headers.get("user-agent"),
  };
}
