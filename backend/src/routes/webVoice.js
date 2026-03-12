import express from "express";
import { v4 as uuidv4 } from "uuid";

import { getSession, updateMeta } from "../services/sessionService.js";
import { askGroq } from "../services/groqService.js";
import { appendHighIntentRow } from "../services/sheetService.js";

const router = express.Router();

/**
 * POST /web/voice
 * body: { sessionId?, text }
 */
router.post("/", async (req, res) => {
  try {
    let { sessionId, text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    // Create or reuse session
    sessionId = sessionId || uuidv4();
    getSession(sessionId); // ensure session exists

    // 1️⃣ Ask Groq (full KB, auto language)
    const ai = await askGroq(text);

    // 2️⃣ Update session meta
    updateMeta(sessionId, ai);

    // 3️⃣ High-intent logging
    if ((ai.intent_level || "").toUpperCase() === "HIGH") {
      const row = [
        new Date().toISOString(),
        sessionId,
        "WEB",
        ai.main_topic || "unknown",
        ai.intent_level,
        ai.summary_for_staff || ai.answer || "",
        ai.escalate ? "YES" : "NO",
      ];

      appendHighIntentRow(row).catch(() => {});
    }

    // 4️⃣ Human fallback
    let humanFallback = null;
    let finalAnswer = ai.answer;

    if (ai.escalate === true) {
      const isAdmissions =
        (ai.main_topic || "").toLowerCase().includes("admission") ||
        (ai.main_topic || "").toLowerCase().includes("fee");

      humanFallback = {
        department: isAdmissions ? "Admissions Office" : "College Helpdesk",
        phone: isAdmissions
          ? process.env.ADMISSIONS_PHONE
          : process.env.HELPDESK_PHONE,
        hours: process.env.OFFICE_HOURS,
      };

      finalAnswer =
        `I'll connect you with a human representative. ` +
        `Please contact the ${humanFallback.department} at ${humanFallback.phone}. ` +
        `They are available ${humanFallback.hours}.`;
    }

    // 5️⃣ Respond
    res.json({
      sessionId,
      answer: finalAnswer,
      escalate: ai.escalate || false,
      humanFallback,
    });
  } catch (err) {
    console.error("WEB VOICE ERROR:", err);
    res.status(500).json({ error: "AI failure" });
  }
});

export default router;
