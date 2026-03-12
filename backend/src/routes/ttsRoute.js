import express from "express";
import sdk from "microsoft-cognitiveservices-speech-sdk";

const router = express.Router();

router.get("/", async (req, res) => {
  const text = req.query.text;

  if (!text) return res.status(400).send("Missing text");

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );

    // 🇮🇳 Single Indian English voice (female, natural)
    speechConfig.speechSynthesisVoiceName = "en-IN-AnanyaNeural";

    // Optional quality improvements
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    synthesizer.speakTextAsync(
      text,
      result => {
        if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
          console.error("Azure TTS error:", result.errorDetails);
          res.status(500).send("TTS failed");
          synthesizer.close();
          return;
        }

        res.setHeader("Content-Type", "audio/wav");
        res.send(Buffer.from(result.audioData));
        synthesizer.close();
      },
      err => {
        console.error("Azure TTS exception:", err);
        res.status(500).send("TTS error");
        synthesizer.close();
      }
    );

  } catch (err) {
    console.error("Azure TTS error:", err);
    res.status(500).send("TTS error");
  }
});

export default router;
