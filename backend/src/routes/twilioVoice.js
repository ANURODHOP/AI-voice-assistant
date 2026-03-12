import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";

import { getSession, setLanguage, updateMeta } from "../services/sessionService.js";
import { findTopKBMatches } from "../services/kbSearchService.js";
import { askGeminiWithKB } from "../services/geminiService.js";
import { appendHighIntentRow } from "../services/sheetService.js";

dotenv.config();
const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// entry: language menu
router.post("/", (req, res) => {
  const vr = new VoiceResponse();
  const gather = vr.gather({ numDigits: 1, action: "/twilio/voice/language", method: "POST" });

  gather.say({ language: "en-IN", voice: "alice" }, "Welcome to the college AI assistant. For English press 1. For Hindi press 2.");
  vr.redirect("/twilio/voice/language");
  res.type("text/xml").send(vr.toString());
});

// language choice
router.post("/language", (req, res) => {
  const { CallSid, Digits } = req.body;
  const lang = Digits === "2" ? "hi" : "en";
  setLanguage(CallSid, lang);

  const vr = new VoiceResponse();
  const gather = vr.gather({ input: "speech", action: "/twilio/voice/ask", method: "POST", timeout: 5 });

  if (lang === "hi") {
    gather.say({ language: "hi-IN", voice: "alice" }, "नमस्ते। आप कॉलेज के एआई असिस्टेंट से बात कर रहे हैं। कृपया अपना सवाल बोलिए।");
  } else {
    gather.say({ language: "en-IN", voice: "alice" }, "Hello. You are speaking with the college AI assistant. Please ask your question.");
  }

  res.type("text/xml").send(vr.toString());
});

// main ask handler
router.post("/ask", async (req, res) => {
  try {
    const { CallSid, SpeechResult, From } = req.body;
    const session = getSession(CallSid);
    const lang = session.language || "en";
    const vr = new VoiceResponse();

    if (!SpeechResult) {
      const gather = vr.gather({ input: "speech", action: "/twilio/voice/ask", method: "POST" });
      if (lang === "hi") gather.say({ language: "hi-IN", voice: "alice" }, "मुझे आपकी आवाज़ स्पष्ट नहीं मिली। कृपया एक बार फिर बोलिए।");
      else gather.say({ language: "en-IN", voice: "alice" }, "I could not hear you clearly. Please say your question again.");
      return res.type("text/xml").send(vr.toString());
    }

    const userQuestion = SpeechResult.trim();
    console.log("CallSid:", CallSid, "From:", From, "Q:", userQuestion);

    // 1) Find top KB matches to include (fast)
    const topMatches = await findTopKBMatches(userQuestion, parseInt(process.env.KB_CONTEXT_ROWS || "5", 10));

    // 2) Ask Gemini with the small KB context
    const ai = await askGeminiWithKB(userQuestion, lang, topMatches);

    // 3) Update session meta
    updateMeta(CallSid, ai);

    // 4) If HIGH intent -> append to High-Intent Sheet
    if ((ai.intent_level || "").toUpperCase() === "HIGH") {
      const now = new Date().toISOString();
      const row = [
        now,
        CallSid,
        From,
        ai.main_topic || "unknown",
        ai.intent_level || "HIGH",
        ai.summary_for_staff || ai.answer || "",
        ai.escalate ? "YES" : "NO"
      ];
      // best-effort: don't block the call flow; but append
      appendHighIntentRow(row).catch(err => console.error("appendHighIntentRow error:", err));
    }

    // 5) Escalation handling: if escalate true, connect to human
    if (ai.escalate) {
      if (lang === "hi") {
        vr.say({ language: "hi-IN", voice: "alice" }, "यह मामला हमारे स्टाफ द्वारा संभाला जाना चाहिए। मैं आपकी कॉल कनेक्ट कर रही हूँ, कृपया लाइन पर बने रहें।");
      } else {
        vr.say({ language: "en-IN", voice: "alice" }, "This seems like something our staff should handle directly. I will connect your call now. Please stay on the line.");
      }
      vr.dial(process.env.HUMAN_FALLBACK_NUMBER);
      return res.type("text/xml").send(vr.toString());
    }

    // 6) Normal reply and continue (use TTS)
    const gather = vr.gather({ input: "speech", action: "/twilio/voice/ask", method: "POST", timeout: 5 });

    if (lang === "hi") gather.say({ language: "hi-IN", voice: "alice" }, ai.answer);
    else gather.say({ language: "en-IN", voice: "alice" }, ai.answer);

    // ask if more
    if (lang === "hi") gather.say({ language: "hi-IN", voice: "alice" }, "क्या आपको और कुछ पूछना है?");
    else gather.say({ language: "en-IN", voice: "alice" }, "Do you want to ask anything else?");

    res.type("text/xml").send(vr.toString());
  } catch (err) {
    console.error("Error in /ask:", err);
    const vr = new VoiceResponse();
    vr.say("System error occurred. Please try again later.");
    return res.type("text/xml").send(vr.toString());
  }
});

export default router;
