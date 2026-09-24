import type { OrganizationRole, ProfileRecord, PublicOrganization, PublicProfile, PublicUser, UserRecord } from "./types";

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function publicProfile(user: UserRecord, profile: ProfileRecord): PublicProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    handle: profile.handle,
    displayName: user.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    category: profile.category,
    links: profile.links,
    visibility: profile.visibility,
    creatorStatus: profile.creatorStatus,
  };
}

export function publicOrganization(
  organization: { id: string; name: string; slug: string },
  role: OrganizationRole,
): PublicOrganization {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role,
  };
}
