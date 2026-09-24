import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { POST as refresh } from "@/app/api/v1/auth/refresh/route";
import { POST as revoke } from "@/app/api/v1/auth/revoke/route";
import { POST as forgotPassword } from "@/app/api/v1/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/v1/auth/reset-password/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { GET as listProfiles, POST as createProfile } from "@/app/api/v1/profiles/route";
import { GET as getOwnProfile, PATCH as patchProfile } from "@/app/api/v1/profiles/me/route";
import { GET as getProfileByHandle } from "@/app/api/v1/profiles/[handle]/route";
import { GET as listOrgs, POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as getOrg } from "@/app/api/v1/organizations/[organizationId]/route";
import { GET as listMembers, POST as addMember } from "@/app/api/v1/organizations/[organizationId]/members/route";
import { PATCH as patchMember } from "@/app/api/v1/organizations/[organizationId]/members/[memberId]/route";
import { resetRateLimitStore } from "@/lib/security";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { createMemoryStore } from "./helpers/memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";

const PASSWORD = "creator-pass-1";

type AuthPayload = {
  user: { id: string; email: string; displayName: string };
  profile: { handle: string } | null;
  tokens: { accessToken: string; refreshToken: string };
};

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Request {
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function registerUser(email: string, displayName = "Creator One"): Promise<AuthPayload> {
  const response = await register(
    jsonRequest("http://localhost/api/v1/auth/register", "POST", {
      email,
      password: PASSWORD,
      displayName,
    }),
    emptyRouteContext,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as AuthPayload;
}

async function loginUser(email: string, password = PASSWORD): Promise<Response> {
  return login(jsonRequest("http://localhost/api/v1/auth/login", "POST", { email, password }), emptyRouteContext);
}

describe("identity", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
  });

  afterEach(() => {
    resetIdentityStore();
    resetRateLimitStore();
  });

  it("registers a user without returning the password", async () => {
    const body = await registerUser("creator@univox.test");
    expect(body.user.email).toBe("creator@univox.test");
    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.refreshToken).toBeTruthy();
    expect(body.profile).toBeNull();
  });

  it("rejects duplicate registration", async () => {
    await registerUser("creator@univox.test");
    const response = await register(
      jsonRequest("http://localhost/api/v1/auth/register", "POST", {
        email: "creator@univox.test",
        password: PASSWORD,
        displayName: "Other",
      }),
      emptyRouteContext,
    );
    expect(response.status).toBe(409);
  });

  it("logs in with valid credentials", async () => {
    await registerUser("creator@univox.test");
    const response = await loginUser("creator@univox.test");
    expect(response.status).toBe(200);
    const body = (await response.json()) as AuthPayload;
    expect(body.user.email).toBe("creator@univox.test");
    expect(body.tokens.accessToken).toBeTruthy();
  });

  it("rejects invalid credentials", async () => {
    await registerUser("creator@univox.test");
    const response = await loginUser("creator@univox.test", "wrong-password-1");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects unauthenticated access to protected resources", async () => {
    const response = await me(jsonRequest("http://localhost/api/v1/users/me", "GET"), emptyRouteContext);
    expect(response.status).toBe(401);
  });

  it("logs out and revokes the current session", async () => {
    const registered = await registerUser("creator@univox.test");
    const logoutResponse = await logout(
      jsonRequest("http://localhost/api/v1/auth/logout", "POST", {}, registered.tokens.accessToken),
      emptyRouteContext,
    );
    expect(logoutResponse.status).toBe(200);
    const meResponse = await me(
      jsonRequest("http://localhost/api/v1/users/me", "GET", undefined, registered.tokens.accessToken),
      emptyRouteContext,
    );
    expect(meResponse.status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse", async () => {
    const registered = await registerUser("creator@univox.test");
    const first = await refresh(
      jsonRequest("http://localhost/api/v1/auth/refresh", "POST", {
        refreshToken: registered.tokens.refreshToken,
      }),
      emptyRouteContext,
    );
    expect(first.status).toBe(200);
    const rotated = (await first.json()) as AuthPayload;
    expect(rotated.tokens.refreshToken).not.toBe(registered.tokens.refreshToken);

    const reuse = await refresh(
      jsonRequest("http://localhost/api/v1/auth/refresh", "POST", {
        refreshToken: registered.tokens.refreshToken,
      }),
      emptyRouteContext,
    );
    expect(reuse.status).toBe(401);
  });

  it("revokes all sessions", async () => {
    const first = await registerUser("creator@univox.test");
    const secondLogin = await loginUser("creator@univox.test");
    const second = (await secondLogin.json()) as AuthPayload;
    const revoked = await revoke(
      jsonRequest("http://localhost/api/v1/auth/revoke", "POST", { all: true }, first.tokens.accessToken),
      emptyRouteContext,
    );
    expect(revoked.status).toBe(200);
    const meFirst = await me(
      jsonRequest("http://localhost/api/v1/users/me", "GET", undefined, first.tokens.accessToken),
      emptyRouteContext,
    );
    const meSecond = await me(
      jsonRequest("http://localhost/api/v1/users/me", "GET", undefined, second.tokens.accessToken),
      emptyRouteContext,
    );
    expect(meFirst.status).toBe(401);
    expect(meSecond.status).toBe(401);
  });

  it("resets a password and invalidates sessions", async () => {
    const registered = await registerUser("creator@univox.test");
    const forgot = await forgotPassword(
      jsonRequest("http://localhost/api/v1/auth/forgot-password", "POST", { email: "creator@univox.test" }),
      emptyRouteContext,
    );
    expect(forgot.status).toBe(200);
    const { resetToken } = (await forgot.json()) as { resetToken: string };
    expect(resetToken).toBeTruthy();
    const reset = await resetPassword(
      jsonRequest("http://localhost/api/v1/auth/reset-password", "POST", {
        token: resetToken,
        password: "new-password-9",
      }),
      emptyRouteContext,
    );
    expect(reset.status).toBe(200);
    const oldSession = await me(
      jsonRequest("http://localhost/api/v1/users/me", "GET", undefined, registered.tokens.accessToken),
      emptyRouteContext,
    );
    expect(oldSession.status).toBe(401);
    const oldLogin = await loginUser("creator@univox.test");
    expect(oldLogin.status).toBe(401);
    const newLogin = await loginUser("creator@univox.test", "new-password-9");
    expect(newLogin.status).toBe(200);
  });

  it("creates, reads, and updates a creator profile", async () => {
    const registered = await registerUser("creator@univox.test", "Ada Lovelace");
    const created = await createProfile(
      jsonRequest(
        "http://localhost/api/v1/profiles",
        "POST",
        {
          handle: "ada-lovelace",
          bio: "Builds computing machines",
          category: "engineering",
          visibility: "PUBLIC",
          links: [{ label: "site", url: "https://example.com" }],
        },
        registered.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.profile.handle).toBe("ada-lovelace");
    expect(createdBody.profile.displayName).toBe("Ada Lovelace");
    expect(createdBody.profile.creatorStatus).toBe("PENDING");

    const own = await getOwnProfile(
      jsonRequest("http://localhost/api/v1/profiles/me", "GET", undefined, registered.tokens.accessToken),
      emptyRouteContext,
    );
    expect(own.status).toBe(200);

    const patched = await patchProfile(
      jsonRequest(
        "http://localhost/api/v1/profiles/me",
        "PATCH",
        { bio: "Updated bio", creatorStatus: "ACTIVE", displayName: "Ada L." },
        registered.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(patched.status).toBe(200);
    const patchedBody = await patched.json();
    expect(patchedBody.profile.bio).toBe("Updated bio");
    expect(patchedBody.profile.displayName).toBe("Ada L.");
    expect(patchedBody.profile.creatorStatus).toBe("ACTIVE");

    const listed = await listProfiles(
      jsonRequest("http://localhost/api/v1/profiles", "GET", undefined, registered.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
  });

  it("hides private profiles from other users", async () => {
    const owner = await registerUser("owner@univox.test");
    await createProfile(
      jsonRequest(
        "http://localhost/api/v1/profiles",
        "POST",
        { handle: "private-creator", visibility: "PRIVATE" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const asStranger = await getProfileByHandle(
      jsonRequest("http://localhost/api/v1/profiles/private-creator", "GET", undefined, stranger.tokens.accessToken),
      routeContext({ handle: "private-creator" }),
    );
    expect(asStranger.status).toBe(403);
    const asOwner = await getProfileByHandle(
      jsonRequest("http://localhost/api/v1/profiles/private-creator", "GET", undefined, owner.tokens.accessToken),
      routeContext({ handle: "private-creator" }),
    );
    expect(asOwner.status).toBe(200);
  });

  it("creates an organization and lists membership", async () => {
    const owner = await registerUser("owner@univox.test");
    const created = await createOrg(
      jsonRequest(
        "http://localhost/api/v1/organizations",
        "POST",
        { name: "Studio One", slug: "studio-one" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.organization.role).toBe("OWNER");
    const listed = await listOrgs(
      jsonRequest("http://localhost/api/v1/organizations", "GET", undefined, owner.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.organizations).toHaveLength(1);
  });

  it("enforces organization role restrictions", async () => {
    const owner = await registerUser("owner@univox.test");
    const member = await registerUser("member@univox.test", "Member");
    const created = await createOrg(
      jsonRequest(
        "http://localhost/api/v1/organizations",
        "POST",
        { name: "Studio One", slug: "studio-one" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const organizationId = (await created.json()).organization.id as string;
    const added = await addMember(
      jsonRequest(
        `http://localhost/api/v1/organizations/${organizationId}/members`,
        "POST",
        { email: "member@univox.test", role: "MEMBER" },
        owner.tokens.accessToken,
      ),
      routeContext({ organizationId }),
    );
    expect(added.status).toBe(201);
    const forbiddenAdd = await addMember(
      jsonRequest(
        `http://localhost/api/v1/organizations/${organizationId}/members`,
        "POST",
        { email: "owner@univox.test", role: "ADMIN" },
        member.tokens.accessToken,
      ),
      routeContext({ organizationId }),
    );
    expect(forbiddenAdd.status).toBe(403);

    const members = await listMembers(
      jsonRequest(
        `http://localhost/api/v1/organizations/${organizationId}/members`,
        "GET",
        undefined,
        owner.tokens.accessToken,
      ),
      routeContext({ organizationId }),
    );
    const memberId = ((await members.json()).members as Array<{ id: string; role: string }>).find(
      (item) => item.role === "MEMBER",
    )?.id as string;
    const promoteToOwner = await patchMember(
      jsonRequest(
        `http://localhost/api/v1/organizations/${organizationId}/members/${memberId}`,
        "PATCH",
        { role: "OWNER" },
        member.tokens.accessToken,
      ),
      routeContext({ organizationId, memberId }),
    );
    expect(promoteToOwner.status).toBe(403);
  });

  it("denies cross-organization access", async () => {
    const alice = await registerUser("alice@univox.test", "Alice");
    const bob = await registerUser("bob@univox.test", "Bob");
    const aliceOrg = await createOrg(
      jsonRequest(
        "http://localhost/api/v1/organizations",
        "POST",
        { name: "Alice Studio", slug: "alice-studio" },
        alice.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const bobOrg = await createOrg(
      jsonRequest(
        "http://localhost/api/v1/organizations",
        "POST",
        { name: "Bob Studio", slug: "bob-studio" },
        bob.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const aliceOrgId = (await aliceOrg.json()).organization.id as string;
    const bobOrgId = (await bobOrg.json()).organization.id as string;
    const cross = await getOrg(
      jsonRequest(`http://localhost/api/v1/organizations/${aliceOrgId}`, "GET", undefined, bob.tokens.accessToken),
      routeContext({ organizationId: aliceOrgId }),
    );
    expect(cross.status).toBe(403);
    const own = await getOrg(
      jsonRequest(`http://localhost/api/v1/organizations/${bobOrgId}`, "GET", undefined, bob.tokens.accessToken),
      routeContext({ organizationId: bobOrgId }),
    );
    expect(own.status).toBe(200);
  });
});
