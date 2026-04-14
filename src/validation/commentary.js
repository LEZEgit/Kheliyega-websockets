import { z } from 'zod';

// Schema for listing commentary with optional limit
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for creating commentary
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string().min(1, 'Period is required and cannot be empty'),
  eventType: z.string().min(1, 'Event type is required and cannot be empty'),
  actor: z.string().min(1, 'Actor is required and cannot be empty'),
  team: z.string().min(1, 'Team is required and cannot be empty'),
  message: z.string().min(1, 'Message is required and cannot be empty'),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});
