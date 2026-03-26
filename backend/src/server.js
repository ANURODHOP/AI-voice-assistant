import cors from "cors";
import "./config/env.js"

import express from "express";
import leadsApi from "./routes/leadsApi.js";
import webVoice from "./routes/webVoice.js";
import ttsRoute from "./routes/ttsRoute.js";   // Text-to-Speech route(tts)
import sttRoute from "./routes/sttRoute.js";   // Speech-to-Text route(stt)
import { initializeVectorRAG } from "./services/vectorRagService.js"; // Rag System Initialization

const app = express();
app.use(cors());
app.use(express.json());

// ✅ NEW: Initialize Vector RAG on startup
let isRagReady = false;

(async () => {
  console.log('\n🚀 Initializing Vector RAG System...\n');
  isRagReady = await initializeVectorRAG();
  
  if (!isRagReady) {
    console.warn('⚠️  Vector RAG failed to initialize. System will use fallback knowledge base.');
  } else {
    console.log('✅ Vector RAG System Ready!\n');
  }
})();

app.get("/", (req, res) => {
  res.json({
    message: "Server is running",
    rag_status: isRagReady ? "ready" : "not_ready"
  });
});

app.use("/leads", leadsApi);
app.use("/web/voice", webVoice);
app.use("/api/tts", ttsRoute);  
app.use("/api/stt", sttRoute); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
});