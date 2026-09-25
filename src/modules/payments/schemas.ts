import { z } from "zod";
import { PRODUCT_STATUSES, PRODUCT_TYPES } from "./types";

export const createProductSchema = z.object({
  type: z.enum(PRODUCT_TYPES).default("MEMBERSHIP"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).optional(),
  amountCents: z.number().int().min(100).max(100_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .default("USD")
    .transform((value) => value.toUpperCase()),
  intervalDays: z.number().int().min(1).max(3650).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    amountCents: z.number().int().min(100).max(100_000_000).optional(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
    intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const initiatePaymentSchema = z.object({
  productId: z.string().min(1),
});
