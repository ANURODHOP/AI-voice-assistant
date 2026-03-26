import express from "express";
import { v4 as uuidv4 } from "uuid";

import { getSession, updateMeta, addMessage } from "../services/sessionService.js"; // ✅ added addMessage
import { askGroq } from "../services/groqService.js";
import { appendHighIntentRow } from "../services/sheetService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let { sessionId, text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    sessionId = sessionId || uuidv4();
    getSession(sessionId);

    // ✅ CHANGED: Store user message BEFORE calling AI
    addMessage(sessionId, 'user', text);

    // ✅ CHANGED: Pass sessionId so groqService can read history
    const ai = await askGroq(text, sessionId);

    updateMeta(sessionId, ai);

    // ✅ NEW: Store AI answer in history
    addMessage(sessionId, 'assistant', ai.answer || '');

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

    let humanFallback = null;
    let finalAnswer = ai.answer;

    if (ai.escalate === true) {
      const isAdmissions =
        (ai.main_topic || "").toLowerCase().includes("admission") ||
        (ai.main_topic || "").toLowerCase().includes("fee");

      humanFallback = {
        department: isAdmissions ? "Admissions Office" : "College Helpdesk",
        phone: isAdmissions ? process.env.ADMISSIONS_PHONE : process.env.HELPDESK_PHONE,
        hours: process.env.OFFICE_HOURS,
      };

      finalAnswer =
        `I'll connect you with a human representative. ` +
        `Please contact the ${humanFallback.department} at ${humanFallback.phone}. ` +
        `They are available ${humanFallback.hours}.`;

      // ✅ NEW: Update stored answer if it was overridden by escalation
      addMessage(sessionId, 'assistant', finalAnswer);
    }

    res.json({ sessionId, answer: finalAnswer, escalate: ai.escalate || false, humanFallback });

  } catch (err) {
    console.error("WEB VOICE ERROR:", err);
    res.status(500).json({ error: "AI failure" });
  }
});

export default router;