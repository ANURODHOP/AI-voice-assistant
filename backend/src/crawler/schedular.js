import cron from "node-cron";
import runCrawler from "./index.js";
import runPreprocess from "./preprocess.js";

console.log("⏳ Weekly crawler scheduler initialized");

// Every Sunday at 3 AM
cron.schedule("0 3 * * 0", async () => {
  try {
    console.log("🕒 Weekly pipeline started");

    await runCrawler();        // STEP 1: Crawl
    await runPreprocess();     // STEP 2: Preprocess

    console.log("✅ Weekly pipeline completed");
  } catch (err) {
    console.error("❌ Weekly pipeline failed:", err);
  }
});
