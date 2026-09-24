export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MODERATOR", "CREATOR", "MEMBER"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ROLE_RANK: Record<OrganizationRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MODERATOR: 30,
  CREATOR: 20,
  MEMBER: 10,
};

export const PROFILE_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const CREATOR_STATUSES = ["PENDING", "ACTIVE", "INACTIVE"] as const;
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type ProfileLink = {
  label: string;
  url: string;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProfileRecord = {
  id: string;
  userId: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  links: ProfileLink[];
  visibility: ProfileVisibility;
  creatorStatus: CreatorStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationMemberRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
};

export type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PasswordResetRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  links: ProfileLink[];
  visibility: ProfileVisibility;
  creatorStatus: CreatorStatus;
};

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
};
