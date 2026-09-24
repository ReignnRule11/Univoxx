import { forbidden, notFound } from "@/lib/errors";
import { getIdentityStore } from "@/modules/identity/store";
import type { ChannelVisibility } from "./types";
import { COMMUNITY_ROLE_RANK, type CommunityRecord, type CommunityRole, type MembershipRecord } from "./types";
import { getCommunityStore } from "./store";

export function hasMinCommunityRole(actual: CommunityRole, required: CommunityRole): boolean {
  return COMMUNITY_ROLE_RANK[actual] >= COMMUNITY_ROLE_RANK[required];
}

export function assertMinCommunityRole(actual: CommunityRole, required: CommunityRole): void {
  if (!hasMinCommunityRole(actual, required)) {
    throw forbidden("Insufficient community role");
  }
}

export function canManageCommunityRole(actorRole: CommunityRole, targetRole: CommunityRole): boolean {
  if (actorRole === "OWNER") {
    return true;
  }
  if (actorRole === "ADMIN") {
    return COMMUNITY_ROLE_RANK[targetRole] < COMMUNITY_ROLE_RANK.ADMIN;
  }
  return false;
}

export function isActiveMember(member: MembershipRecord | null): member is MembershipRecord & { status: "ACTIVE" } {
  return Boolean(member && member.status === "ACTIVE");
}

export async function requireCommunity(communityId: string): Promise<CommunityRecord> {
  const community = await getCommunityStore().findCommunityById(communityId);
  if (!community) {
    throw notFound("Community not found");
  }
  return community;
}

export async function requireActiveCommunityMember(
  userId: string,
  communityId: string,
  minRole: CommunityRole = "MEMBER",
): Promise<{ community: CommunityRecord; membership: MembershipRecord }> {
  const community = await requireCommunity(communityId);
  const membership = await getCommunityStore().findMembership(communityId, userId);
  if (!isActiveMember(membership)) {
    throw forbidden("Not a member of this community");
  }
  assertMinCommunityRole(membership.role, minRole);
  return { community, membership };
}

export async function requireCommunityView(
  userId: string,
  communityId: string,
): Promise<{ community: CommunityRecord; membership: MembershipRecord | null }> {
  const community = await requireCommunity(communityId);
  const membership = await getCommunityStore().findMembership(communityId, userId);
  if (membership?.status === "BANNED") {
    throw forbidden("You are banned from this community");
  }
  if (isActiveMember(membership)) {
    return { community, membership };
  }
  if (community.visibility === "PUBLIC") {
    const orgMember = await getIdentityStore().findMember(community.organizationId, userId);
    if (orgMember) {
      return { community, membership: null };
    }
  }
  throw forbidden("Not allowed to access this community");
}

export function canViewChannel(membership: MembershipRecord | null, visibility: ChannelVisibility): boolean {
  if (visibility === "PRIVATE") {
    return isActiveMember(membership) && hasMinCommunityRole(membership.role, "MODERATOR");
  }
  if (visibility === "RESTRICTED") {
    return isActiveMember(membership);
  }
  return true;
}

export function canPostInChannel(membership: MembershipRecord | null, visibility: ChannelVisibility): boolean {
  if (!isActiveMember(membership)) {
    return false;
  }
  if (visibility === "OPEN") {
    return true;
  }
  return hasMinCommunityRole(membership.role, "MODERATOR");
}

export function canSeeContent(
  status: "PUBLISHED" | "HIDDEN" | "DELETED",
  authorId: string,
  userId: string,
  membership: MembershipRecord | null,
): boolean {
  if (status === "PUBLISHED") {
    return true;
  }
  if (status === "HIDDEN") {
    return authorId === userId || (isActiveMember(membership) && hasMinCommunityRole(membership.role, "MODERATOR"));
  }
  return isActiveMember(membership) && hasMinCommunityRole(membership.role, "MODERATOR");
}
