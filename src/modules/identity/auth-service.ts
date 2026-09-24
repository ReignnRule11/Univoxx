import { getConfig } from "@/lib/config";
import { conflict, forbidden, unauthorized, validationError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { randomToken, sha256 } from "@/lib/tokens";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, signSession, type SessionClaims } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security";
import { getIdentityStore } from "./store";
import { publicProfile, publicUser } from "./serializers";
import type { PublicProfile, PublicUser, SessionRecord, UserRecord } from "./types";

const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
};

export type AuthResult = {
  user: PublicUser;
  profile: PublicProfile | null;
  tokens: IssuedTokens;
};

export type PasswordResetIssue = {
  accepted: true;
  resetToken?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issueTokens(user: UserRecord, session: SessionRecord): Promise<IssuedTokens> {
  const claims: SessionClaims = { sub: user.id, email: user.email, sid: session.id };
  const accessToken = await signSession(claims);
  return {
    accessToken,
    refreshToken: "",
    expiresIn: ACCESS_TTL_SECONDS,
    sessionId: session.id,
  };
}

async function createSessionForUser(
  user: UserRecord,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<{ tokens: IssuedTokens; rawRefresh: string }> {
  const store = getIdentityStore();
  const rawRefresh = randomToken(48);
  const session = await store.createSession({
    userId: user.id,
    refreshTokenHash: sha256(rawRefresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  const tokens = await issueTokens(user, session);
  return { tokens: { ...tokens, refreshToken: rawRefresh }, rawRefresh };
}

async function withProfile(user: UserRecord): Promise<{ user: PublicUser; profile: PublicProfile | null }> {
  const store = getIdentityStore();
  const profile = await store.findProfileByUserId(user.id);
  return {
    user: publicUser(user),
    profile: profile ? publicProfile(user, profile) : null,
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<AuthResult> {
  const store = getIdentityStore();
  const email = normalizeEmail(input.email);
  const existing = await store.findUserByEmail(email);
  if (existing) {
    throw conflict("Email is already registered");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await store.createUser({
    email,
    passwordHash,
    displayName: input.displayName,
  });
  const { tokens } = await createSessionForUser(user, input);
  return {
    user: publicUser(user),
    profile: null,
    tokens,
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  consumeRateLimit(`login:${email}`, LOGIN_MAX, LOGIN_WINDOW_MS);
  if (input.ip) {
    consumeRateLimit(`login-ip:${input.ip}`, LOGIN_MAX * 4, LOGIN_WINDOW_MS);
  }
  const store = getIdentityStore();
  const user = await store.findUserByEmail(email);
  if (!user || !user.passwordHash) {
    throw unauthorized("Invalid email or password");
  }
  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    throw unauthorized("Invalid email or password");
  }
  if (user.status !== "ACTIVE") {
    throw forbidden("Account is not active");
  }
  const { tokens } = await createSessionForUser(user, input);
  const view = await withProfile(user);
  return { ...view, tokens };
}

export async function refreshSession(rawRefreshToken: string): Promise<AuthResult> {
  const store = getIdentityStore();
  const session = await store.findSessionByRefreshHash(sha256(rawRefreshToken));
  if (!session) {
    throw unauthorized("Invalid refresh token");
  }
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    if (session.revokedAt) {
      await store.revokeUserSessions(session.userId);
    }
    throw unauthorized("Refresh token is no longer valid");
  }
  const user = await store.findUserById(session.userId);
  if (!user || user.status !== "ACTIVE") {
    await store.revokeSession(session.id);
    throw unauthorized("Session is no longer valid");
  }
  await store.revokeSession(session.id);
  const { tokens } = await createSessionForUser(user, {
    ip: session.ip,
    userAgent: session.userAgent,
  });
  const view = await withProfile(user);
  return { ...view, tokens };
}

export async function logoutSession(sessionId: string): Promise<void> {
  const store = getIdentityStore();
  const session = await store.findSessionById(sessionId);
  if (session && !session.revokedAt) {
    await store.revokeSession(sessionId);
  }
}

export async function revokeSessions(userId: string, currentSessionId: string, all: boolean): Promise<{ revoked: number }> {
  const store = getIdentityStore();
  if (all) {
    const revoked = await store.revokeUserSessions(userId);
    return { revoked };
  }
  await store.revokeSession(currentSessionId);
  return { revoked: 1 };
}

export async function requestPasswordReset(email: string, ip?: string | null): Promise<PasswordResetIssue> {
  const normalized = normalizeEmail(email);
  consumeRateLimit(`reset:${normalized}`, RESET_MAX, RESET_WINDOW_MS);
  if (ip) {
    consumeRateLimit(`reset-ip:${ip}`, RESET_MAX * 4, RESET_WINDOW_MS);
  }
  const store = getIdentityStore();
  const user = await store.findUserByEmail(normalized);
  const accepted: PasswordResetIssue = { accepted: true };
  if (!user || user.status !== "ACTIVE") {
    return accepted;
  }
  const token = randomToken(32);
  await store.createPasswordReset(user.id, sha256(token), new Date(Date.now() + RESET_TTL_MS));
  if (getConfig().NODE_ENV !== "production") {
    accepted.resetToken = token;
  }
  return accepted;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const store = getIdentityStore();
  const record = await store.findPasswordResetByHash(sha256(token));
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw validationError("Reset token is invalid or expired");
  }
  const user = await store.findUserById(record.userId);
  if (!user) {
    throw validationError("Reset token is invalid or expired");
  }
  const passwordHash = await hashPassword(password);
  await store.updateUser(user.id, { passwordHash });
  await store.markPasswordResetUsed(record.id);
  await store.revokeUserSessions(user.id);
}

export async function currentUserView(user: UserRecord) {
  return withProfile(user);
}
