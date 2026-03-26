import { exec } from "child_process";

import { crawlResource } from "./crawl.js";
import { resetExcel, saveToExcel } from "./saveExcel.js";
import { START_URLS, MAX_DEPTH, MAX_PAGES, DELAY_MS } from "./config.js";
import runPreprocess from "./preprocess.js";


function runEmbeddings() {
  return new Promise((resolve, reject) => {
    console.log("🧠 Running embeddings...");

    exec("node src/setup-embeddings.js", (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Embedding error: ${error.message}`);
        reject(error);
        return;
      }

      if (stderr) {
        console.error(`⚠️ Embedding stderr: ${stderr}`);
      }

      console.log(stdout);
      console.log("✅ Embeddings completed");
      resolve();
    });
  });
}

const visited = new Set();
const rows = [];
const queue = []; // ✅ Queue for BFS

const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = '';
    return urlObj.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function crawlPage(url, depth) {
  const normalized = normalizeUrl(url);
  if (!normalized) return [];
  
  if (visited.has(normalized)) return [];
  if (depth > MAX_DEPTH) return [];
  
  visited.add(normalized);
  console.log(`🔍 [${visited.size}/${MAX_PAGES}] depth:${depth} ${normalized}`);
  
  try {
    const result = await crawlResource(normalized);
    if (!result) return [];

    const { content_type, text, links } = result;

    // ✅ Save ALL content (no length filter here)
    if (text) {
      rows.push({
        source_url: normalized,
        content_type,
        raw_text: text,
        chunk_index: 0,
        crawled_at: new Date().toISOString(),
        depth: depth,
      });
      
      console.log(`   ✅ Saved ${content_type}: ${text.length} chars`);
    }

    await sleep(DELAY_MS);
    return links || [];
    
  } catch (err) {
    console.log("❌ Failed:", normalized, err.message);
    return [];
  }
}

async function crawlBFS() {
  console.log("🚀 Starting breadth-first crawler...");
  
  // Initialize queue
  for (const url of START_URLS) {
    queue.push({ url, depth: 0 });
  }
  
  // Process queue
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const { url, depth } = queue.shift(); // ✅ Take from front (BFS)
    
    const childLinks = await crawlPage(url, depth);
    
    // Add children to queue
    for (const link of childLinks) {
      queue.push({ url: link, depth: depth + 1 });
    }
    
    // Progress log
    if (visited.size % 25 === 0) {
      console.log(`📊 Progress: ${visited.size} pages, ${queue.length} in queue`);
    }
  }
}

export default async function runCrawler() {
  console.log("🚀 Crawler started");
  resetExcel();
  
  await crawlBFS();
  
  saveToExcel(rows);
  console.log(`✅ Crawl complete: ${rows.length} records saved`);
  
  await runPreprocess();
}

// Run if called directly
await runCrawler();

await runEmbeddings();