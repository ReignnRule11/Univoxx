import { forbidden, notFound, unauthorized } from "@/lib/errors";
import { getIdentityStore } from "./store";
import { ROLE_RANK, type OrganizationMemberRecord, type OrganizationRole, type UserRecord } from "./types";

export function hasMinRole(actual: OrganizationRole, required: OrganizationRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function assertMinRole(actual: OrganizationRole, required: OrganizationRole): void {
  if (!hasMinRole(actual, required)) {
    throw forbidden("Insufficient organization role");
  }
}

export async function requireActiveUser(userId: string): Promise<UserRecord> {
  const store = getIdentityStore();
  const user = await store.findUserById(userId);
  if (!user || user.status === "DELETED") {
    throw unauthorized("Invalid session");
  }
  if (user.status !== "ACTIVE") {
    throw forbidden("Account is not active");
  }
  return user;
}

export async function requireOrganizationMember(
  userId: string,
  organizationId: string,
  minRole: OrganizationRole = "MEMBER",
): Promise<OrganizationMemberRecord> {
  const store = getIdentityStore();
  const organization = await store.findOrganizationById(organizationId);
  if (!organization) {
    throw notFound("Organization not found");
  }
  const member = await store.findMember(organizationId, userId);
  if (!member) {
    throw forbidden("Not a member of this organization");
  }
  assertMinRole(member.role, minRole);
  return member;
}

export function canManageRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  if (actorRole === "OWNER") {
    return true;
  }
  if (actorRole === "ADMIN") {
    return ROLE_RANK[targetRole] < ROLE_RANK.ADMIN;
  }
  return false;
}
