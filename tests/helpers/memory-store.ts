import { conflict } from "@/lib/errors";
import type { IdentityStore, CreateProfileInput, CreateSessionInput, CreateUserInput } from "@/modules/identity/store";
import type {
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRole,
  PasswordResetRecord,
  ProfileRecord,
  SessionRecord,
  UserRecord,
} from "@/modules/identity/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createMemoryStore(): IdentityStore {
  const users = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, string>();
  const profiles = new Map<string, ProfileRecord>();
  const profilesByHandle = new Map<string, string>();
  const organizations = new Map<string, OrganizationRecord>();
  const organizationsBySlug = new Map<string, string>();
  const members = new Map<string, OrganizationMemberRecord>();
  const sessions = new Map<string, SessionRecord>();
  const sessionsByHash = new Map<string, string>();
  const resets = new Map<string, PasswordResetRecord>();
  const resetsByHash = new Map<string, string>();

  const store: IdentityStore = {
    async findUserById(userId) {
      return users.get(userId) ?? null;
    },
    async findUserByEmail(email) {
      const userId = usersByEmail.get(email);
      return userId ? users.get(userId) ?? null : null;
    },
    async createUser(input: CreateUserInput) {
      if (usersByEmail.has(input.email)) {
        throw conflict("Email is already registered");
      }
      const created: UserRecord = {
        id: id("user"),
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        status: "ACTIVE",
        createdAt: now(),
        updatedAt: now(),
      };
      users.set(created.id, created);
      usersByEmail.set(created.email, created.id);
      return created;
    },
    async updateUser(userId, data) {
      const current = users.get(userId);
      if (!current) {
        throw new Error("User not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      users.set(userId, updated);
      return updated;
    },
    async findProfileByUserId(userId) {
      return profiles.get(userId) ?? null;
    },
    async findProfileByHandle(handle) {
      const userId = profilesByHandle.get(handle);
      return userId ? profiles.get(userId) ?? null : null;
    },
    async createProfile(input: CreateProfileInput) {
      if (profiles.has(input.userId)) {
        throw conflict("Creator profile already exists");
      }
      if (profilesByHandle.has(input.handle)) {
        throw conflict("Profile handle is already taken");
      }
      const created: ProfileRecord = {
        id: id("profile"),
        userId: input.userId,
        handle: input.handle,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        category: input.category ?? null,
        links: input.links ?? [],
        visibility: input.visibility ?? "PRIVATE",
        creatorStatus: input.creatorStatus ?? "PENDING",
        createdAt: now(),
        updatedAt: now(),
      };
      profiles.set(created.userId, created);
      profilesByHandle.set(created.handle, created.userId);
      return created;
    },
    async updateProfile(userId, data) {
      const current = profiles.get(userId);
      if (!current) {
        throw new Error("Profile not found");
      }
      if (data.handle && data.handle !== current.handle) {
        if (profilesByHandle.has(data.handle)) {
          throw conflict("Profile handle is already taken");
        }
        profilesByHandle.delete(current.handle);
        profilesByHandle.set(data.handle, userId);
      }
      const updated: ProfileRecord = {
        ...current,
        handle: data.handle ?? current.handle,
        bio: data.bio === undefined ? current.bio : data.bio,
        avatarUrl: data.avatarUrl === undefined ? current.avatarUrl : data.avatarUrl,
        category: data.category === undefined ? current.category : data.category,
        links: data.links ?? current.links,
        visibility: data.visibility ?? current.visibility,
        creatorStatus: data.creatorStatus ?? current.creatorStatus,
        updatedAt: now(),
      };
      profiles.set(userId, updated);
      return updated;
    },
    async createOrganization(name, slug) {
      if (organizationsBySlug.has(slug)) {
        throw conflict("Organization slug is already taken");
      }
      const created: OrganizationRecord = {
        id: id("org"),
        name,
        slug,
        createdAt: now(),
        updatedAt: now(),
      };
      organizations.set(created.id, created);
      organizationsBySlug.set(slug, created.id);
      return created;
    },
    async findOrganizationById(organizationId) {
      return organizations.get(organizationId) ?? null;
    },
    async findOrganizationBySlug(slug) {
      const organizationId = organizationsBySlug.get(slug);
      return organizationId ? organizations.get(organizationId) ?? null : null;
    },
    async listOrganizationsForUser(userId) {
      return [...members.values()]
        .filter((member) => member.userId === userId)
        .map((member) => {
          const organization = organizations.get(member.organizationId);
          if (!organization) {
            throw new Error("Organization missing");
          }
          return { ...organization, role: member.role };
        });
    },
    async addMember(organizationId, userId, role: OrganizationRole) {
      const exists = [...members.values()].find(
        (member) => member.organizationId === organizationId && member.userId === userId,
      );
      if (exists) {
        throw conflict("User is already a member of this organization");
      }
      const created: OrganizationMemberRecord = {
        id: id("member"),
        organizationId,
        userId,
        role,
        createdAt: now(),
      };
      members.set(created.id, created);
      return created;
    },
    async findMember(organizationId, userId) {
      return (
        [...members.values()].find(
          (member) => member.organizationId === organizationId && member.userId === userId,
        ) ?? null
      );
    },
    async findMemberById(organizationId, memberId) {
      const member = members.get(memberId);
      if (!member || member.organizationId !== organizationId) {
        return null;
      }
      return member;
    },
    async listMembers(organizationId) {
      return [...members.values()].filter((member) => member.organizationId === organizationId);
    },
    async updateMemberRole(memberId, role) {
      const current = members.get(memberId);
      if (!current) {
        throw new Error("Member not found");
      }
      const updated = { ...current, role };
      members.set(memberId, updated);
      return updated;
    },
    async removeMember(memberId) {
      members.delete(memberId);
    },
    async countOwners(organizationId) {
      return [...members.values()].filter(
        (member) => member.organizationId === organizationId && member.role === "OWNER",
      ).length;
    },
    async createSession(input: CreateSessionInput) {
      const created: SessionRecord = {
        id: id("session"),
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      sessions.set(created.id, created);
      sessionsByHash.set(created.refreshTokenHash, created.id);
      return created;
    },
    async findSessionById(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async findSessionByRefreshHash(refreshTokenHash) {
      const sessionId = sessionsByHash.get(refreshTokenHash);
      return sessionId ? sessions.get(sessionId) ?? null : null;
    },
    async updateSession(sessionId, data) {
      const current = sessions.get(sessionId);
      if (!current) {
        throw new Error("Session not found");
      }
      if (data.refreshTokenHash && data.refreshTokenHash !== current.refreshTokenHash) {
        sessionsByHash.delete(current.refreshTokenHash);
        sessionsByHash.set(data.refreshTokenHash, sessionId);
      }
      const updated = { ...current, ...data, updatedAt: now() };
      sessions.set(sessionId, updated);
      return updated;
    },
    async revokeSession(sessionId, at = now()) {
      const current = sessions.get(sessionId);
      if (current) {
        sessions.set(sessionId, { ...current, revokedAt: at, updatedAt: now() });
      }
    },
    async revokeUserSessions(userId, at = now()) {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.userId === userId && !session.revokedAt) {
          sessions.set(session.id, { ...session, revokedAt: at, updatedAt: now() });
          count += 1;
        }
      }
      return count;
    },
    async createPasswordReset(userId, tokenHash, expiresAt) {
      const created: PasswordResetRecord = {
        id: id("reset"),
        userId,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: now(),
      };
      resets.set(created.id, created);
      resetsByHash.set(tokenHash, created.id);
      return created;
    },
    async findPasswordResetByHash(tokenHash) {
      const resetId = resetsByHash.get(tokenHash);
      return resetId ? resets.get(resetId) ?? null : null;
    },
    async markPasswordResetUsed(resetId, at = now()) {
      const current = resets.get(resetId);
      if (current) {
        resets.set(resetId, { ...current, usedAt: at });
      }
    },
  };

  return store;
}
