import { z } from "zod";

// Match status constants
export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

// Schema for listing matches with optional limit
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for match ID parameter
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema for creating a match
export const createMatchSchema = z
  .object({
    sport: z.string().min(1, "Sport is required and cannot be empty"),
    homeTeam: z.string().min(1, "Home team is required and cannot be empty"),
    awayTeam: z.string().min(1, "Away team is required and cannot be empty"),
    startTime: z.iso.datetime({local: true}),
    endTime: z.iso.datetime({local: true}),
    homeScore: z.number().int().nonnegative().optional(),
    awayScore: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime must be chronologically after startTime",
      });
    }
  });

// Schema for updating match scores
export const updateScoreSchema = z.object({
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
});
