import { Router } from "express";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentry";
import { matchIdParamSchema } from "../validation/matches";
import { commentary } from "../db/schema";
import { db } from "../db/db";

const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
  res
    .status(200)
    .json({ message: "List commentary endpoint - to be implemented" });
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

    return res.status(201).json(result);
  } catch (error) {
    console.error("Failed to create commentary:", error);
    return res.status(500).json({ error: "Failed to create commentary" });
  }
});

export default commentaryRouter;
