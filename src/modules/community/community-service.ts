import { conflict, forbidden, notFound } from "@/lib/errors";
import { requireOrganizationMember } from "@/modules/identity/authorization";
import { getIdentityStore } from "@/modules/identity/store";
import type { UserRecord } from "@/modules/identity/types";
import {
  canManageCommunityRole,
  isActiveMember,
  requireActiveCommunityMember,
  requireCommunity,
  requireCommunityView,
} from "./authorization";
import { publicCommunity, publicMembership } from "./serializers";
import { getCommunityStore } from "./store";
import type { CommunityRole, MembershipStatus, PublicCommunity, PublicMembership } from "./types";

async function notify(
  userId: string,
  communityId: string,
  type: "MEMBERSHIP_ADDED" | "MEMBERSHIP_BANNED",
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getCommunityStore().createNotification({
    userId,
    communityId,
    type,
    title,
    body,
    data,
  });
}

export async function createCommunity(
  user: UserRecord,
  input: {
    organizationId: string;
    name: string;
    slug: string;
    description?: string;
    visibility?: PublicCommunity["visibility"];
  },
): Promise<PublicCommunity> {
  await requireOrganizationMember(user.id, input.organizationId, "ADMIN");
  const store = getCommunityStore();
  const community = await store.createCommunity({
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    visibility: input.visibility ?? "PRIVATE",
    createdById: user.id,
  });
  const membership = await store.createMembership(community.id, user.id, "OWNER");
  return publicCommunity(community, membership);
}

export async function listCommunities(userId: string, organizationId?: string): Promise<PublicCommunity[]> {
  const store = getCommunityStore();
  const memberships = await store.listMembershipsForUser(userId);
  const membershipByCommunity = new Map(memberships.map((row) => [row.communityId, row]));
  const ids = new Set(memberships.map((row) => row.communityId));

  if (organizationId) {
    await requireOrganizationMember(userId, organizationId);
    for (const community of await store.listCommunitiesByOrganization(organizationId)) {
      if (community.visibility === "PUBLIC") {
        ids.add(community.id);
      }
    }
  }

  const communities = await store.listCommunitiesByIds([...ids]);
  return communities
    .filter((community) => {
      if (organizationId && community.organizationId !== organizationId) {
        return false;
      }
      const membership = membershipByCommunity.get(community.id) ?? null;
      if (isActiveMember(membership)) {
        return true;
      }
      if (membership?.status === "BANNED") {
        return false;
      }
      return community.visibility === "PUBLIC";
    })
    .map((community) => publicCommunity(community, membershipByCommunity.get(community.id) ?? null));
}

export async function getCommunity(userId: string, communityId: string): Promise<PublicCommunity> {
  const { community, membership } = await requireCommunityView(userId, communityId);
  return publicCommunity(community, membership);
}

export async function updateCommunity(
  user: UserRecord,
  communityId: string,
  input: { name?: string; description?: string | null; visibility?: PublicCommunity["visibility"] },
): Promise<PublicCommunity> {
  const { membership } = await requireActiveCommunityMember(user.id, communityId, "ADMIN");
  const community = await getCommunityStore().updateCommunity(communityId, input);
  return publicCommunity(community, membership);
}

export async function deleteCommunity(user: UserRecord, communityId: string): Promise<void> {
  await requireActiveCommunityMember(user.id, communityId, "OWNER");
  await getCommunityStore().deleteCommunity(communityId);
}

export async function listCommunityMembers(userId: string, communityId: string): Promise<PublicMembership[]> {
  await requireActiveCommunityMember(userId, communityId);
  const members = await getCommunityStore().listMemberships(communityId);
  return members.map(publicMembership);
}

export async function addCommunityMember(
  actor: UserRecord,
  communityId: string,
  input: { userId?: string; email?: string; role: CommunityRole },
): Promise<PublicMembership> {
  const { membership: actorMember } = await requireActiveCommunityMember(actor.id, communityId, "ADMIN");
  if (!canManageCommunityRole(actorMember.role, input.role)) {
    throw forbidden("Cannot assign a role equal to or above your own");
  }
  const identity = getIdentityStore();
  let target = input.userId ? await identity.findUserById(input.userId) : null;
  if (!target && input.email) {
    target = await identity.findUserByEmail(input.email);
  }
  if (!target || target.status !== "ACTIVE") {
    throw notFound("User not found");
  }
  const existing = await getCommunityStore().findMembership(communityId, target.id);
  if (existing) {
    throw conflict("User is already a member of this community");
  }
  const member = await getCommunityStore().createMembership(communityId, target.id, input.role);
  await notify(
    target.id,
    communityId,
    "MEMBERSHIP_ADDED",
    "Added to community",
    "You were added to a community",
    { communityId, role: input.role },
  );
  return publicMembership(member);
}

export async function updateCommunityMember(
  actor: UserRecord,
  communityId: string,
  memberId: string,
  input: { role?: CommunityRole; status?: MembershipStatus },
): Promise<PublicMembership> {
  await requireCommunity(communityId);
  const store = getCommunityStore();
  const target = await store.findMembershipById(communityId, memberId);
  if (!target) {
    throw notFound("Member not found");
  }

  if (input.status && input.status !== target.status) {
    const { membership: actorMember } = await requireActiveCommunityMember(actor.id, communityId, "MODERATOR");
    if (target.userId === actor.id) {
      throw forbidden("Cannot change your own membership status");
    }
    if (!canManageCommunityRole(actorMember.role, target.role) && actorMember.role !== "MODERATOR") {
      throw forbidden("Cannot change this member's status");
    }
    if (actorMember.role === "MODERATOR" && (target.role === "OWNER" || target.role === "ADMIN")) {
      throw forbidden("Cannot change this member's status");
    }
    if (target.role === "OWNER" && input.status !== "ACTIVE") {
      const owners = await store.countOwners(communityId);
      if (owners <= 1) {
        throw conflict("Community must keep at least one owner");
      }
    }
    const updated = await store.updateMembership(target.id, { status: input.status });
    if (input.status === "BANNED") {
      await notify(
        target.userId,
        communityId,
        "MEMBERSHIP_BANNED",
        "Removed from community",
        "You were banned from a community",
        { communityId },
      );
    }
    if (input.role && input.role !== target.role) {
      return updateCommunityMemberRole(actor, communityId, updated.id, input.role);
    }
    return publicMembership(updated);
  }

  if (input.role && input.role !== target.role) {
    return updateCommunityMemberRole(actor, communityId, target.id, input.role);
  }
  return publicMembership(target);
}

async function updateCommunityMemberRole(
  actor: UserRecord,
  communityId: string,
  memberId: string,
  role: CommunityRole,
): Promise<PublicMembership> {
  const { membership: actorMember } = await requireActiveCommunityMember(actor.id, communityId, "ADMIN");
  const store = getCommunityStore();
  const target = await store.findMembershipById(communityId, memberId);
  if (!target) {
    throw notFound("Member not found");
  }
  if (!canManageCommunityRole(actorMember.role, target.role) || !canManageCommunityRole(actorMember.role, role)) {
    throw forbidden("Cannot change this member's role");
  }
  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await store.countOwners(communityId);
    if (owners <= 1) {
      throw conflict("Community must keep at least one owner");
    }
  }
  const updated = await store.updateMembership(target.id, { role });
  return publicMembership(updated);
}

export async function removeCommunityMember(actor: UserRecord, communityId: string, memberId: string): Promise<void> {
  const { membership: actorMember } = await requireActiveCommunityMember(actor.id, communityId, "ADMIN");
  const store = getCommunityStore();
  const target = await store.findMembershipById(communityId, memberId);
  if (!target) {
    throw notFound("Member not found");
  }
  if (target.userId === actor.id) {
    throw forbidden("Cannot remove yourself");
  }
  if (!canManageCommunityRole(actorMember.role, target.role)) {
    throw forbidden("Cannot remove this member");
  }
  if (target.role === "OWNER") {
    const owners = await store.countOwners(communityId);
    if (owners <= 1) {
      throw conflict("Community must keep at least one owner");
    }
  }
  await store.removeMembership(target.id);
}
