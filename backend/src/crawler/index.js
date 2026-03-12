import { crawlResource } from "./crawl.js";
import { resetExcel, saveToExcel } from "./saveExcel.js";
import { START_URL, MAX_DEPTH, MAX_PAGES } from "./config.js";

const visited = new Set();
const rows = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function crawl(url, depth = 0) {
  if (visited.has(url)) return;
  if (depth > MAX_DEPTH) return;
  if (visited.size >= MAX_PAGES) return;

  visited.add(url);
  console.log("🔍 Crawling:", url);

  try {
    const result = await crawlResource(url);
    if (!result) return;

    const { content_type, text, links } = result;

    // save BOTH html & pdf text
    if (text && text.length > 50) {
      rows.push({
        source_url: url,
        content_type,
        raw_text: text,
        chunk_index: 0,
        crawled_at: new Date().toISOString(),
      });
    }

    await sleep(1000); // polite crawling

    for (const link of links) {
      await crawl(link, depth + 1);
    }
  } catch (err) {
    console.log("❌ Failed:", url);
  }
} 

export default async function runCrawler() {
  console.log("🚀 Weekly crawler started");
  resetExcel();              // delete old data (your chosen strategy)
  await crawl(START_URL);
  saveToExcel(rows);
  console.log(`✅ Crawl complete: ${rows.length} records saved`);
}

runCrawler();
