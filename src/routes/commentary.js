import { Router } from "express";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { matchIdParamSchema } from "../validation/matches.js";
import {
  listCommentaryQuerySchema,
  createCommentarySchema as createCommentaryValidation,
} from "../validation/commentary.js";
import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
  // Validate match ID from params
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({
      error: "Invalid match ID.",
      details: paramsParsed.error.issues,
    });
  }

  // Validate query parameters
  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    return res.status(400).json({
      error: "Invalid query parameters.",
      details: queryParsed.error.issues,
    });
  }

  try {
    const limit = Math.min(queryParsed.data.limit || 100, MAX_LIMIT);

    const commentaries = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsParsed.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.status(200).json({ data: commentaries, count: commentaries.length });
  } catch (error) {
    console.error("Error fetching commentaries:", error);
    res.status(500).json({
      error: "Failed to fetch commentaries.",
      //   details: JSON.stringify(error),
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
  // Validate match ID from params
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({
      error: "Invalid match ID.",
      details: paramsParsed.error.issues,
    });
  }

  // Validate commentary data from body
  const bodyParsed = createCommentaryValidation.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({
      error: "Invalid commentary data.",
      details: bodyParsed.error.issues,
    });
  }

  try {
    // Check if match exists
    const matchExists = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.id, paramsParsed.data.id))
      .limit(1);

    if (matchExists.length === 0) {
      return res.status(404).json({
        error: "Match not found.",
        details: `No match with ID ${paramsParsed.data.id} exists.`,
      });
    }

    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        matchId: paramsParsed.data.id,
        ...bodyParsed.data,
      })
      .returning();

      if (res.app.locals.broadcastCommentary) {
      try {
        res.app.locals.broadcastCommentary(createdCommentary.matchId, createdCommentary);
      } catch (broadcastError) {
        console.error(
          "Failed to broadcast commentary",
          broadcastError,
        );
      }
    }

    res.status(201).json({ data: createdCommentary });
  } catch (error) {
    console.error("Error creating commentary:", error);
    res.status(500).json({
      error: "Failed to create commentary.",
      //   details: JSON.stringify(error),
    });
  }
});
