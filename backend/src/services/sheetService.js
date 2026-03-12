import fs from "fs";
import KB_FILE from "../crawler/data/brain_data.json" with { type: "json" };

export async function readKBRows() {
  console.log("📖 KB loaded:", KB_FILE.length, "entries");
  return KB_FILE;
}

export async function appendHighIntentRow(rowValues) {
  // TODO: hook up to a real logger if needed later
  console.log("📝 High intent row:", rowValues);
}

export async function readIntentLog() {
  return [];
}