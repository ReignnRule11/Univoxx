import { z } from "zod";
import { EVENT_ACCESS_TYPES } from "./types";

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid ISO datetime",
});

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(8000).optional(),
    communityId: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    startsAt: isoDateTime,
    endsAt: isoDateTime.optional(),
    accessType: z.enum(EVENT_ACCESS_TYPES).default("FREE"),
    priceCents: z.number().int().min(100).max(100_000_000).optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined)),
    capacity: z.number().int().min(1).max(100_000).optional(),
  })
  .refine((value) => value.accessType !== "PAID" || typeof value.priceCents === "number", {
    message: "priceCents is required for paid events",
    path: ["priceCents"],
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.nullable().optional(),
    accessType: z.enum(EVENT_ACCESS_TYPES).optional(),
    priceCents: z.number().int().min(100).max(100_000_000).nullable().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined)),
    capacity: z.number().int().min(1).max(100_000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const registerEventSchema = z.object({
  transactionId: z.string().min(1).optional(),
});

export const createChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const createTranscriptSchema = z.object({
  text: z.string().trim().min(1).max(200_000),
  source: z.string().trim().min(1).max(64).default("upload"),
});
