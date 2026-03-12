import dotenv from "dotenv";
dotenv.config();

import {
  readKBRows,
  appendHighIntentRow,
  readIntentLog,
} from "./sheetService.js";

(async () => {
  try {
    console.log("📖 Reading KB rows...",process.env.GOOGLE_SHEETS_KB_ID);
    const kb = await readKBRows();
    console.log("KB rows:", kb);

    console.log("📝 Appending intent log...");
    await appendHighIntentRow([
      new Date().toISOString(),
      "test-session",
      "What is CSE fee?",
      "fees",
      "MEDIUM",
      "false",
      "Test log from backend",
    ]);

    console.log("📊 Reading intent log...");
    const logs = await readIntentLog();
    console.log("Intent logs:", logs);

    console.log("✅ Google Sheets integration WORKING");
  } catch (err) {
    console.error("❌ Sheets test failed:", err.message);
  }
})();
