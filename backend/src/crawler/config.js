import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_FILE = path.join(__dirname, "data", "raw_bmsce.xlsx");

export const ROOT_DOMAIN = "bmsce.ac.in";

export const START_URLS = [
  "https://bmsce.ac.in",
  "https://bmsce.ac.in/home/About-BMSET-Hostels",
  "https://bmsce.ac.in/home/About-Sports",
  "https://bmsce.ac.in/home/About-Library",
  "https://bmsce.ac.in/home/About-Placements",

];

export const MAX_DEPTH = 2;
export const MAX_PAGES = 300;

export const BLOCKED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg",
  ".zip", ".rar", ".doc", ".docx", ".ppt", ".pptx"
];

export const BLOCKED_PATH_KEYWORDS = [
  "login", "admin", "dashboard", "portal", "wp-admin",
  "Slider", "website_notifications",
  "/news/", "/events/", "/home/news", "/home/events",
  "NewsEvents", "faculty-development", "fdp", "webinar",
  "value-added-course", "Scholarships", "NACC", "IQAC",
  "GraduationDay", "B-S-Narayan", "Notifications",
];

export const ALLOWED_PDF_KEYWORDS = [
  "fee", "fees", "admission", "eligibility", "regulation",
  "rules", "syllabus", "calendar", "prospectus",
  "hostel", "placement", "scholarship",
];