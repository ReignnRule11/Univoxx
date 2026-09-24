import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import type {
  OrganizationMemberRecord,
  OrganizationRecord,
  OrganizationRole,
  PasswordResetRecord,
  ProfileLink,
  ProfileRecord,
  SessionRecord,
  UserRecord,
} from "./types";

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
};

export type CreateProfileInput = {
  userId: string;
  handle: string;
  bio?: string | null;
  avatarUrl?: string | null;
  category?: string | null;
  links?: ProfileLink[];
  visibility?: ProfileRecord["visibility"];
  creatorStatus?: ProfileRecord["creatorStatus"];
};

export type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
};

export type IdentityStore = {
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  updateUser(id: string, data: Partial<Pick<UserRecord, "displayName" | "passwordHash" | "status">>): Promise<UserRecord>;
  findProfileByUserId(userId: string): Promise<ProfileRecord | null>;
  findProfileByHandle(handle: string): Promise<ProfileRecord | null>;
  createProfile(input: CreateProfileInput): Promise<ProfileRecord>;
  updateProfile(userId: string, data: Partial<Omit<ProfileRecord, "id" | "userId" | "createdAt" | "updatedAt">>): Promise<ProfileRecord>;
  createOrganization(name: string, slug: string): Promise<OrganizationRecord>;
  findOrganizationById(id: string): Promise<OrganizationRecord | null>;
  findOrganizationBySlug(slug: string): Promise<OrganizationRecord | null>;
  listOrganizationsForUser(userId: string): Promise<Array<OrganizationRecord & { role: OrganizationRole }>>;
  addMember(organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationMemberRecord>;
  findMember(organizationId: string, userId: string): Promise<OrganizationMemberRecord | null>;
  findMemberById(organizationId: string, memberId: string): Promise<OrganizationMemberRecord | null>;
  listMembers(organizationId: string): Promise<OrganizationMemberRecord[]>;
  updateMemberRole(memberId: string, role: OrganizationRole): Promise<OrganizationMemberRecord>;
  removeMember(memberId: string): Promise<void>;
  countOwners(organizationId: string): Promise<number>;
  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSessionById(id: string): Promise<SessionRecord | null>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  updateSession(id: string, data: Partial<Pick<SessionRecord, "refreshTokenHash" | "expiresAt" | "revokedAt">>): Promise<SessionRecord>;
  revokeSession(id: string, at?: Date): Promise<void>;
  revokeUserSessions(userId: string, at?: Date): Promise<number>;
  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetRecord>;
  findPasswordResetByHash(tokenHash: string): Promise<PasswordResetRecord | null>;
  markPasswordResetUsed(id: string, at?: Date): Promise<void>;
};

function toUser(row: {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  status: UserRecord["status"];
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return row;
}

function parseLinks(value: unknown): ProfileLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ProfileLink => {
    return Boolean(
      item &&
        typeof item === "object" &&
        "label" in item &&
        "url" in item &&
        typeof (item as ProfileLink).label === "string" &&
        typeof (item as ProfileLink).url === "string",
    );
  });
}

function toProfile(row: {
  id: string;
  userId: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  links: unknown;
  visibility: ProfileRecord["visibility"];
  creatorStatus: ProfileRecord["creatorStatus"];
  createdAt: Date;
  updatedAt: Date;
}): ProfileRecord {
  return { ...row, links: parseLinks(row.links) };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaIdentityStore: IdentityStore = {
  async findUserById(id) {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  },
  async findUserByEmail(email) {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  },
  async createUser(input) {
    try {
      return toUser(await prisma.user.create({ data: input }));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Email is already registered");
      }
      throw error;
    }
  },
  async updateUser(id, data) {
    return toUser(await prisma.user.update({ where: { id }, data }));
  },
  async findProfileByUserId(userId) {
    const row = await prisma.profile.findUnique({ where: { userId } });
    return row ? toProfile(row) : null;
  },
  async findProfileByHandle(handle) {
    const row = await prisma.profile.findUnique({ where: { handle } });
    return row ? toProfile(row) : null;
  },
  async createProfile(input) {
    try {
      return toProfile(
        await prisma.profile.create({
          data: {
            userId: input.userId,
            handle: input.handle,
            bio: input.bio,
            avatarUrl: input.avatarUrl,
            category: input.category,
            links: input.links ?? [],
            visibility: input.visibility,
            creatorStatus: input.creatorStatus,
          },
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Profile handle is already taken");
      }
      throw error;
    }
  },
  async updateProfile(userId, data) {
    try {
      return toProfile(
        await prisma.profile.update({
          where: { userId },
          data: {
            ...data,
            links: data.links,
          },
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Profile handle is already taken");
      }
      throw error;
    }
  },
  async createOrganization(name, slug) {
    try {
      return await prisma.organization.create({ data: { name, slug } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Organization slug is already taken");
      }
      throw error;
    }
  },
  async findOrganizationById(id) {
    return prisma.organization.findUnique({ where: { id } });
  },
  async findOrganizationBySlug(slug) {
    return prisma.organization.findUnique({ where: { slug } });
  },
  async listOrganizationsForUser(userId) {
    const rows = await prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return rows.map((row) => ({ ...row.organization, role: row.role }));
  },
  async addMember(organizationId, userId, role) {
    try {
      return await prisma.organizationMember.create({ data: { organizationId, userId, role } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("User is already a member of this organization");
      }
      throw error;
    }
  },
  async findMember(organizationId, userId) {
    return prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  },
  async findMemberById(organizationId, memberId) {
    const row = await prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!row || row.organizationId !== organizationId) {
      return null;
    }
    return row;
  },
  async listMembers(organizationId) {
    return prisma.organizationMember.findMany({ where: { organizationId } });
  },
  async updateMemberRole(memberId, role) {
    return prisma.organizationMember.update({ where: { id: memberId }, data: { role } });
  },
  async removeMember(memberId) {
    await prisma.organizationMember.delete({ where: { id: memberId } });
  },
  async countOwners(organizationId) {
    return prisma.organizationMember.count({ where: { organizationId, role: "OWNER" } });
  },
  async createSession(input) {
    return prisma.session.create({ data: input });
  },
  async findSessionById(id) {
    return prisma.session.findUnique({ where: { id } });
  },
  async findSessionByRefreshHash(refreshTokenHash) {
    return prisma.session.findUnique({ where: { refreshTokenHash } });
  },
  async updateSession(id, data) {
    return prisma.session.update({ where: { id }, data });
  },
  async revokeSession(id, at = new Date()) {
    await prisma.session.update({ where: { id }, data: { revokedAt: at } });
  },
  async revokeUserSessions(userId, at = new Date()) {
    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
    return result.count;
  },
  async createPasswordReset(userId, tokenHash, expiresAt) {
    return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  },
  async findPasswordResetByHash(tokenHash) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  },
  async markPasswordResetUsed(id, at = new Date()) {
    await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: at } });
  },
};

let activeStore: IdentityStore = prismaIdentityStore;

export function getIdentityStore(): IdentityStore {
  return activeStore;
}

export function setIdentityStore(store: IdentityStore): void {
  activeStore = store;
}

export function resetIdentityStore(): void {
  activeStore = prismaIdentityStore;
}
