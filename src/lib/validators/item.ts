import { z } from 'zod';

export const mockCompleteSchema = z.object({
  amount: z.number().int().positive().max(100).default(1),
  idempotencyKey: z.string().trim().min(8).max(120)
});
