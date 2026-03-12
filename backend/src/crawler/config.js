import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Excel will ALWAYS be here:
// src/crawler/data/raw_bmsce.xlsx
export const OUTPUT_FILE = path.join(__dirname, "data", "raw_bmsce.xlsx");

export const ROOT_DOMAIN = "bmsce.ac.in";
export const START_URL = "https://www.bmsce.ac.in";

export const MAX_DEPTH = 2;
export const MAX_PAGES = 150;

export const BLOCKED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg",
  ".zip", ".rar", ".doc", ".docx", ".ppt", ".pptx"
];

export const BLOCKED_PATH_KEYWORDS = [
  "login",
  "admin",
  "dashboard",
  "portal",
  "wp-admin",
  "NewsEvents",
  "Slider",
  "website_notifications"
];


export const ALLOWED_PDF_KEYWORDS = [
  "fee",
  "fees",
  "admission",
  "eligibility",
  "regulation",
  "rules",
  "syllabus",
  "calendar",
  "prospectus",
  "hostel"
];

