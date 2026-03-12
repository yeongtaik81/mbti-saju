import { z } from 'zod';

export const adminWalletAdjustmentSchema = z.object({
  action: z.enum(['CHARGE', 'DEDUCT']),
  amount: z.number().int().min(1).max(100),
  reason: z.string().trim().min(2).max(100)
});

export type AdminWalletAdjustmentPayload = z.infer<
  typeof adminWalletAdjustmentSchema
>;
