import { conflict, forbidden, notFound } from "@/lib/errors";
import { canManageRole, requireOrganizationMember } from "./authorization";
import { publicOrganization } from "./serializers";
import { getIdentityStore } from "./store";
import type { OrganizationRole, PublicOrganization, UserRecord } from "./types";

export async function createOrganization(
  user: UserRecord,
  input: { name: string; slug: string },
): Promise<PublicOrganization> {
  const store = getIdentityStore();
  const organization = await store.createOrganization(input.name, input.slug);
  await store.addMember(organization.id, user.id, "OWNER");
  return publicOrganization(organization, "OWNER");
}

export async function listUserOrganizations(userId: string): Promise<PublicOrganization[]> {
  const store = getIdentityStore();
  const rows = await store.listOrganizationsForUser(userId);
  return rows.map((row) => publicOrganization(row, row.role));
}

export async function getOrganization(userId: string, organizationId: string): Promise<PublicOrganization> {
  const member = await requireOrganizationMember(userId, organizationId);
  const store = getIdentityStore();
  const organization = await store.findOrganizationById(organizationId);
  if (!organization) {
    throw notFound("Organization not found");
  }
  return publicOrganization(organization, member.role);
}

export async function listOrganizationMembers(userId: string, organizationId: string) {
  await requireOrganizationMember(userId, organizationId);
  const store = getIdentityStore();
  const members = await store.listMembers(organizationId);
  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  }));
}

export async function addOrganizationMember(
  actor: UserRecord,
  organizationId: string,
  input: { userId?: string; email?: string; role: OrganizationRole },
) {
  const actorMember = await requireOrganizationMember(actor.id, organizationId, "ADMIN");
  if (!canManageRole(actorMember.role, input.role)) {
    throw forbidden("Cannot assign a role equal to or above your own");
  }
  const store = getIdentityStore();
  let target = input.userId ? await store.findUserById(input.userId) : null;
  if (!target && input.email) {
    target = await store.findUserByEmail(input.email);
  }
  if (!target || target.status !== "ACTIVE") {
    throw notFound("User not found");
  }
  if (target.id === actor.id && input.role !== actorMember.role) {
    throw forbidden("Cannot change your own membership this way");
  }
  const member = await store.addMember(organizationId, target.id, input.role);
  return {
    id: member.id,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

export async function updateOrganizationMember(
  actor: UserRecord,
  organizationId: string,
  memberId: string,
  role: OrganizationRole,
) {
  const actorMember = await requireOrganizationMember(actor.id, organizationId, "ADMIN");
  const store = getIdentityStore();
  const target = await store.findMemberById(organizationId, memberId);
  if (!target) {
    throw notFound("Member not found");
  }
  if (!canManageRole(actorMember.role, target.role) || !canManageRole(actorMember.role, role)) {
    throw forbidden("Cannot change this member's role");
  }
  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await store.countOwners(organizationId);
    if (owners <= 1) {
      throw conflict("Organization must keep at least one owner");
    }
  }
  const updated = await store.updateMemberRole(target.id, role);
  return {
    id: updated.id,
    userId: updated.userId,
    role: updated.role,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function removeOrganizationMember(actor: UserRecord, organizationId: string, memberId: string) {
  const actorMember = await requireOrganizationMember(actor.id, organizationId, "ADMIN");
  const store = getIdentityStore();
  const target = await store.findMemberById(organizationId, memberId);
  if (!target) {
    throw notFound("Member not found");
  }
  if (target.userId === actor.id) {
    throw forbidden("Cannot remove yourself");
  }
  if (!canManageRole(actorMember.role, target.role)) {
    throw forbidden("Cannot remove this member");
  }
  if (target.role === "OWNER") {
    const owners = await store.countOwners(organizationId);
    if (owners <= 1) {
      throw conflict("Organization must keep at least one owner");
    }
  }
  await store.removeMember(target.id);
}
