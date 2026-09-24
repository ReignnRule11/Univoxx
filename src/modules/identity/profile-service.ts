import { forbidden, notFound } from "@/lib/errors";
import { getIdentityStore } from "./store";
import { publicProfile } from "./serializers";
import type { CreatorStatus, ProfileLink, ProfileVisibility, PublicProfile, UserRecord } from "./types";

export async function getOwnProfile(user: UserRecord): Promise<PublicProfile> {
  const store = getIdentityStore();
  const profile = await store.findProfileByUserId(user.id);
  if (!profile) {
    throw notFound("Creator profile not found");
  }
  return publicProfile(user, profile);
}

export async function getPublicProfile(handle: string, viewerId?: string): Promise<PublicProfile> {
  const store = getIdentityStore();
  const profile = await store.findProfileByHandle(handle);
  if (!profile) {
    throw notFound("Creator profile not found");
  }
  const owner = await store.findUserById(profile.userId);
  if (!owner || owner.status !== "ACTIVE") {
    throw notFound("Creator profile not found");
  }
  const isOwner = viewerId === owner.id;
  if (profile.visibility === "PRIVATE" && !isOwner) {
    throw forbidden("This profile is private");
  }
  return publicProfile(owner, profile);
}

export async function createCreatorProfile(
  user: UserRecord,
  input: {
    handle: string;
    bio?: string | null;
    avatarUrl?: string | null;
    category?: string | null;
    links?: ProfileLink[];
    visibility?: ProfileVisibility;
    creatorStatus?: CreatorStatus;
  },
): Promise<PublicProfile> {
  const store = getIdentityStore();
  const existing = await store.findProfileByUserId(user.id);
  if (existing) {
    throw forbidden("Creator profile already exists");
  }
  const profile = await store.createProfile({
    userId: user.id,
    handle: input.handle,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    category: input.category,
    links: input.links ?? [],
    visibility: input.visibility ?? "PRIVATE",
    creatorStatus: input.creatorStatus ?? "PENDING",
  });
  return publicProfile(user, profile);
}

export async function updateCreatorProfile(
  user: UserRecord,
  input: {
    handle?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    category?: string | null;
    links?: ProfileLink[];
    visibility?: ProfileVisibility;
    creatorStatus?: CreatorStatus;
  },
): Promise<PublicProfile> {
  const store = getIdentityStore();
  const existing = await store.findProfileByUserId(user.id);
  if (!existing) {
    throw notFound("Creator profile not found");
  }
  let nextUser = user;
  if (input.displayName) {
    nextUser = await store.updateUser(user.id, { displayName: input.displayName });
  }
  const profile = await store.updateProfile(user.id, {
    handle: input.handle,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    category: input.category,
    links: input.links,
    visibility: input.visibility,
    creatorStatus: input.creatorStatus,
  });
  return publicProfile(nextUser, profile);
}
