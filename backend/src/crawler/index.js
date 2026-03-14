import { crawlResource } from "./crawl.js";
import { resetExcel, saveToExcel } from "./saveExcel.js";
import { START_URLS, MAX_DEPTH, MAX_PAGES } from "./config.js";
import runPreprocess from "./preprocess.js";

const visited = new Set();
const rows = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function crawl(url, depth = 0) {
  if (visited.has(url)) return;
  if (depth > MAX_DEPTH) return;
  if (visited.size >= MAX_PAGES) return;

  visited.add(url);
  console.log(`🔍 [${visited.size}/${MAX_PAGES}] depth:${depth} ${url}`);

  try {
    const result = await crawlResource(url);
    if (!result) return;

    const { content_type, text, links } = result;

    if (text && text.length > 50) {
      rows.push({
        source_url: url,
        content_type,
        raw_text: text,
        chunk_index: 0,
        crawled_at: new Date().toISOString(),
      });
    }

    await sleep(800);

    for (const link of links) {
      await crawl(link, depth + 1);
    }
  } catch (err) {
    console.log("❌ Failed:", url, err.message);
  }
}

export default async function runCrawler() {
  console.log("🚀 Weekly crawler started");
  resetExcel();

  for (const url of START_URLS) {
    console.log(`\n📌 Seeding: ${url}`);
    await crawl(url);
  }

  saveToExcel(rows);
  console.log(`✅ Crawl complete: ${rows.length} records saved`);
  await runPreprocess();
}

await runCrawler();