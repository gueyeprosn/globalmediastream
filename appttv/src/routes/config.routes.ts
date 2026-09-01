import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { getLiveConfig, updateLiveConfig } from "../services/messages.service";

const router = Router();

router.use(requireAdmin);

router.get("/live", async (_req, res, next) => {
  try {
    const data = await getLiveConfig();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

const liveSchema = z.object({
  hlsUrl: z.string().optional(),
  viewers: z.number().optional(),
  ads: z
    .array(
      z.object({
        id: z.string(),
        category: z.string(),
        title: z.string(),
        cta: z.string(),
        url: z.string(),
      })
    )
    .optional(),
});

router.put("/live", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = liveSchema.parse(req.body);
    await updateLiveConfig(parsed);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
