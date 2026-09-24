import { z } from "zod";
import { handleSchema } from "@/modules/identity/schemas";
import {
  CHANNEL_VISIBILITIES,
  COMMUNITY_ROLES,
  COMMUNITY_VISIBILITIES,
  MEMBERSHIP_STATUSES,
  MODERATION_ACTION_TYPES,
  REACTION_TARGET_TYPES,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
} from "./types";

export const createCommunitySchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  slug: handleSchema,
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(COMMUNITY_VISIBILITIES).optional(),
});

export const updateCommunitySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    visibility: z.enum(COMMUNITY_VISIBILITIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const addCommunityMemberSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    role: z.enum(COMMUNITY_ROLES).default("MEMBER"),
  })
  .refine((value) => Boolean(value.userId || value.email), {
    message: "userId or email is required",
  });

export const updateCommunityMemberSchema = z
  .object({
    role: z.enum(COMMUNITY_ROLES).optional(),
    status: z.enum(MEMBERSHIP_STATUSES).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "role or status is required",
  });

export const createChannelSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: handleSchema,
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(CHANNEL_VISIBILITIES).optional(),
});

export const updateChannelSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    visibility: z.enum(CHANNEL_VISIBILITIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parentId: z.string().min(1).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const createReactionSchema = z.object({
  targetType: z.enum(REACTION_TARGET_TYPES),
  targetId: z.string().min(1),
  emoji: z.string().trim().min(1).max(32),
});

export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  details: z.string().trim().max(2000).optional(),
});

export const updateReportSchema = z.object({
  status: z.enum(REPORT_STATUSES).refine((value) => value !== "OPEN", {
    message: "Report status must be RESOLVED or DISMISSED",
  }),
});

export const createModerationSchema = z.object({
  type: z.enum(MODERATION_ACTION_TYPES),
  targetType: z.string().trim().min(1).max(40),
  targetId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const markNotificationSchema = z.object({
  read: z.boolean(),
});

export const listCommunitiesQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
});

export const listReactionsQuerySchema = z.object({
  targetType: z.enum(REACTION_TARGET_TYPES),
  targetId: z.string().min(1),
});

export const deleteReactionQuerySchema = listReactionsQuerySchema.extend({
  emoji: z.string().trim().min(1).max(32),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});
