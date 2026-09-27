import { z } from "zod";

export const dashboardQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    organizationId: z.string().min(1).optional(),
  })
  .refine((value) => {
    if (!value.from || !value.to) {
      return true;
    }
    return new Date(value.from).getTime() <= new Date(value.to).getTime();
  }, { message: "from must be before to" });
