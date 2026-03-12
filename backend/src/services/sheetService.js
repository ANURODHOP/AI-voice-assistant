import { google } from "googleapis";
import fs from "fs";
import path from "path";
import KB_FILE from "../crawler/data/brain_data.json" with {type: "json"};

function getAuth(scopes) {
  const credsPath = path.join(
    process.cwd(),
    "src/config/google-creds.json"
  );

  const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));

  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes,
  });
}

export async function readKBRows() {
  if (!fs.existsSync(KB_FILE)) {
    console.warn("⚠️ Main file was not found");
    return [];
  }

  const raw = fs.readFileSync(KB_FILE, "utf-8");
  const data = JSON.parse(raw);

  console.log("📖 KB loaded from JSON:", data.length);
  return data;
}

export async function appendHighIntentRow(rowValues) {
  const auth = getAuth([
    "https://www.googleapis.com/auth/spreadsheets",
  ]);

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_INTENT_LOG_ID,
    range: "Sheet1!A2:G",
    valueInputOption: "RAW",
    requestBody: { values: [rowValues] },
  });
}

export async function readIntentLog() {
  const auth = getAuth([
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_INTENT_LOG_ID,
    range: "Sheet1!A2:G",
  });

  return res.data.values || [];
}
