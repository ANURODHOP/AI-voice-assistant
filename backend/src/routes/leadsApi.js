// Optional for now. Admin read for lead intents from sheet.

import express from "express";
import { readIntentLog } from "../services/sheetService.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await readIntentLog();
    const leads = rows.map(r => {
      const [time, callSid, phone, topic, intent, summary, escalate] = r;
      return { time, callSid, phone, topic, intent, summary, escalate };
    });
    res.json({ leads });
  } catch (err) {
    console.error("readIntentLog error:", err);
    res.status(500).json({ error: "Failed to read intent log" });
  }
});

export default router;
