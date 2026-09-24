import { z } from "zod";
import { CREATOR_STATUSES, ORGANIZATION_ROLES, PROFILE_VISIBILITIES } from "./types";

export const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-zA-Z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_REGEX, "Handle must be 3-32 characters of lowercase letters, numbers, and hyphens");

export const emailSchema = z.string().trim().toLowerCase().email();

export const profileLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().url().max(500),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const revokeSchema = z.object({
  all: z.boolean().optional(),
});

export const createProfileSchema = z.object({
  handle: handleSchema,
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  category: z.string().trim().max(60).optional(),
  links: z.array(profileLinkSchema).max(8).optional(),
  visibility: z.enum(PROFILE_VISIBILITIES).optional(),
  creatorStatus: z.enum(CREATOR_STATUSES).optional(),
});

export const updateProfileSchema = createProfileSchema
  .omit({ handle: true })
  .extend({
    handle: handleSchema.optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: handleSchema,
});

export const addMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  email: emailSchema.optional(),
  role: z.enum(ORGANIZATION_ROLES).default("MEMBER"),
}).refine((value) => Boolean(value.userId || value.email), {
  message: "userId or email is required",
});

export const updateMemberSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES),
});
