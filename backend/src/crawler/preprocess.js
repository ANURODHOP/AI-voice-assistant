import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_EXCEL = path.join(__dirname, "data", "raw_bmsce.xlsx");
const OUTPUT_JSON = path.join(__dirname, "data", "brain_data.json");

const MIN_TEXT_LENGTH = 150;  // ✅ Lowered from 200
const CHUNK_SIZE = 800;        // ✅ Increased from 700
const CHUNK_OVERLAP = 150;     // ✅ Increased from 100

// ✅ MINIMAL boilerplate removal
const BOILERPLATE_PATTERNS = [
  "© bms college of engineering. all rights reserved",
  "powered by",
];

// ✅ REMOVED junk keywords - events/workshops ARE valuable!

function normalizeText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F]+/g, "")
    .trim();
}

function removeBoilerplate(text) {
  let t = text;
  for (const phrase of BOILERPLATE_PATTERNS) {
    t = t.replaceAll(phrase, "");
  }
  return t.trim();
}

function chunkText(text, size, overlap) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + size;
    const chunk = text.slice(start, end).trim();

    if (chunk.length >= 100) {
      chunks.push(chunk);
    }

    start += size - overlap;
  }

  return chunks;
}

export default async function runPreprocess() {
  if (!fs.existsSync(INPUT_EXCEL)) {
    console.error("❌ raw_bmsce.xlsx not found");
    return;
  }

  console.log("🧹 Preprocessing started");

  const workbook = xlsx.readFile(INPUT_EXCEL);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const seenHashes = new Set();
  const brainData = [];
  let chunkId = 0;

  for (const row of rows) {
    if (!row.raw_text) continue;

    let text = normalizeText(row.raw_text);
    text = removeBoilerplate(text);

    if (text.length < MIN_TEXT_LENGTH) continue;

    // ✅ Simple deduplication (first 300 chars)
    const fingerprint = text.slice(0, 300);
    if (seenHashes.has(fingerprint)) continue;
    seenHashes.add(fingerprint);

    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

    chunks.forEach((chunk, index) => {
      brainData.push({
        id: chunkId++,
        source_url: row.source_url,
        content_type: row.content_type,
        chunk_index: index,
        text: chunk,
      });
    });
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(brainData, null, 2), "utf-8");

  console.log("✅ Preprocessing complete");
  console.log(`🧠 Brain chunks: ${brainData.length}`);
  console.log(`📄 From ${rows.length} raw pages`);
}