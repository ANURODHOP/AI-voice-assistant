import cors from "cors";
import "./config/env.js"

import express from "express";
import leadsApi from "./routes/leadsApi.js";
import webVoice from "./routes/webVoice.js";
import ttsRoute from "./routes/ttsRoute.js";   // Text-to-Speech route(tts)
import sttRoute from "./routes/sttRoute.js";   // Speech-to-Text route(stt)


const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/leads", leadsApi);
app.use("/web/voice", webVoice);
app.use("/api/tts", ttsRoute);  
app.use("/api/stt", sttRoute); 



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});
