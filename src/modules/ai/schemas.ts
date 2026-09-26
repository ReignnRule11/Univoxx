import { z } from "zod";

export const captionsSchema = z.object({
  contentId: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(8000).optional(),
  tone: z.string().trim().max(40).optional(),
}).refine((value) => Boolean(value.contentId || value.text), {
  message: "contentId or text is required",
});

export const repurposeSchema = z.object({
  contentId: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(12000).optional(),
  format: z.enum(["thread", "newsletter", "short"]).default("thread"),
}).refine((value) => Boolean(value.contentId || value.text), {
  message: "contentId or text is required",
});

export const analyticsExplainSchema = z.object({
  question: z.string().trim().max(500).optional(),
});
