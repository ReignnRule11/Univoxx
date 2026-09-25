import { z } from "zod";
import { CONTENT_TYPES, CONTENT_VISIBILITIES, FEED_SCOPES } from "./types";

export const createContentSchema = z
  .object({
    type: z.enum(CONTENT_TYPES).default("TEXT"),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(20000).optional(),
    visibility: z.enum(CONTENT_VISIBILITIES).optional(),
    communityId: z.string().min(1).optional(),
  })
  .refine((value) => value.type !== "TEXT" || Boolean(value.body && value.body.length > 0), {
    message: "body is required for text content",
    path: ["body"],
  });

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().max(20000).nullable().optional(),
    visibility: z.enum(CONTENT_VISIBILITIES).optional(),
    communityId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const publishContentSchema = z.object({
  visibility: z.enum(CONTENT_VISIBILITIES).optional(),
});

export const feedQuerySchema = z.object({
  scope: z.enum(FEED_SCOPES).default("newest"),
  communityId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
});

export const createContentCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parentId: z.string().min(1).optional(),
});

export const createContentReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});

export const deleteContentReactionQuerySchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});
