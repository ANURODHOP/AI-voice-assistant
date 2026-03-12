import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { OUTPUT_FILE } from "./config.js";

const EXCEL_CELL_LIMIT = 30000;

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function resetExcel() {
  ensureDirExists(OUTPUT_FILE);

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet([]);

  xlsx.utils.book_append_sheet(workbook, worksheet, "RAW_DATA");
  xlsx.writeFile(workbook, OUTPUT_FILE);

  console.log("🧹 Old Excel data cleared");
}


function splitText(text, size = EXCEL_CELL_LIMIT) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export function saveToExcel(rows) {
  ensureDirExists(OUTPUT_FILE); // 🔥 FIX HERE

  let workbook;
  let existing = [];

  if (fs.existsSync(OUTPUT_FILE)) {
    workbook = xlsx.readFile(OUTPUT_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    existing = xlsx.utils.sheet_to_json(sheet);
  } else {
    workbook = xlsx.utils.book_new();
  }

  const safeRows = [];

  for (const row of rows) {
    if (row.raw_text.length > EXCEL_CELL_LIMIT) {
      const parts = splitText(row.raw_text);
      parts.forEach((part, index) => {
        safeRows.push({
          source_url: row.source_url,
          raw_text: part,
          chunk_index: index,
          crawled_at: row.crawled_at,
        });
      });
    } else {
      safeRows.push(row);
    }
  }

  const combined = [...existing, ...safeRows];

  const worksheet = xlsx.utils.json_to_sheet(combined);
  workbook.Sheets = {};
  workbook.SheetNames = [];
  xlsx.utils.book_append_sheet(workbook, worksheet, "RAW_DATA");

  xlsx.writeFile(workbook, OUTPUT_FILE);
}
