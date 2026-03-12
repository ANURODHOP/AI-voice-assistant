import express from "express";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEEPGRAM_KEY = process.env.Deepgram_API_KEY;

router.post("/", upload.single("audio"), async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  try {
    const params = new URLSearchParams({
      model: "nova-3",
      language: "multi",
      languages: "en,hi",
      punctuate: "true",
      smart_format: "true",
      keyterm: [
        "BMSCE:2",
        "COMEDK:2",
        "VTU:1",
        "placements:2",
        "hostel:1",
        "admissions:1"
      ].join(" ")
    });

    const response = await fetch(
      "https://api.deepgram.com/v1/listen?" + params.toString(),
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_KEY}`,
          "Content-Type": "audio/webm",
        },
        body: req.file.buffer,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Deepgram error:", text);
      return res.status(502).json({ error: "Transcription failed" });
    }

    const data = await response.json();
    const alt = data?.results?.channels?.[0]?.alternatives?.[0];

    if (!alt || !alt.transcript?.trim() || alt.confidence < 0.65) {
      return res.json({ transcript: "" });
    }

    res.json({
      transcript: alt.transcript.trim(),
      confidence: alt.confidence,
      detected_language: data?.results?.channels?.[0]?.detected_language || "unknown",
    });

  } catch (err) {
    console.error("STT server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;