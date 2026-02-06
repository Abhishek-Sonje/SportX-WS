import { Router } from "express";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentry";
import { matchIdParamSchema } from "../validation/matches";
import { commentary } from "../db/schema";
import { db } from "../db/db";
import { desc, eq } from "drizzle-orm";

const commentaryRouter = Router({ mergeParams: true });
const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID parameter",
      details: paramsResult.error.issues,
    });
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: queryResult.error.issues,
    });
  }

  const limit = Math.min(queryResult.data.limit ?? 50, MAX_LIMIT);
  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsResult.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to fetch commentary:", error);
    return res.status(500).json({ error: "Failed to fetch commentary" });
  }
});

commentaryRouter.post("/", async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match ID parameter",
      details: paramsResult.error.issues,
    });
  }

  const bodyResult = createCommentarySchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({
      error: "Invalid commentary data",
      details: bodyResult.error.issues,
    });
  }

  try {
    const { minutes, ...rest } = bodyResult.data;
    const [result] = await db
      .insert(commentary)
      .values({
        ...rest,
        matchId: paramsResult.data.id,
        minute: minutes,
      })
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("Failed to create commentary:", error);
    return res.status(500).json({ error: "Failed to create commentary" });
  }
});

export default commentaryRouter;
