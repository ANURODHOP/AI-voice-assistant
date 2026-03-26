import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_FILE = path.join(__dirname, "data", "raw_bmsce.xlsx");
export const ROOT_DOMAIN = "bmsce.ac.in";



export const START_URLS = [
  //Starting point
  "https://bmsce.ac.in/home/",
  
  //Courses and departments
  "https://bmsce.ac.in/home/Civil-Engineering-About",
  "https://bmsce.ac.in/home/Mechanical-Engineering-About",
  "https://bmsce.ac.in/home/Electrical-and-Electronics-Engineering-About",
  "https://bmsce.ac.in/home/Electronics-and-Communication-Engineering-About",
  "https://bmsce.ac.in/home/Industrial-Engineering-and-Management-About",
  "https://bmsce.ac.in/home/Computer-Science-and-Engineering-About",
  "https://bmsce.ac.in/home/Electronics-and-Telecommunication-Engineering-About",
  "https://bmsce.ac.in/home/Information-Science-and-Engineering-About",
  "https://bmsce.ac.in/home/Electronics-and-Instrumentation-Engineering-About",
  "https://bmsce.ac.in/home/Medical-Electronics-Engineering-About",
  "https://bmsce.ac.in/home/Chemical-Engineering-About",
  "https://bmsce.ac.in/home/Bio-Technology-About",
  "https://bmsce.ac.in/home/Computer-Applications-MCA-About",
  "https://bmsce.ac.in/home/Management-Studies-and-Research-Centre-About",
  "https://bmsce.ac.in/home/Mathematics-Department-About",
  "https://bmsce.ac.in/home/Physics-Department-About",
  "https://bmsce.ac.in/home/Chemistry-Department-About",
  "https://bmsce.ac.in/home/Aerospace-Engineering-About",
  "https://bmsce.ac.in/home/Machine-Learning-AI-and-ML-About",
  "https://bmsce.ac.in/home/Computer-Science-and-Engineering-DS-About",
  "https://bmsce.ac.in/home/Computer-Science-and-Engineering-IoT-and-CS-About",
  "https://bmsce.ac.in/home/Artificial-Intelligence-and-Data-Science-About",
  "https://bmsce.ac.in/home/Computer-Science-and-Business-Systems-About",

  //Admissions
  "https://bmsce.ac.in/home/Under-Graduation",
  "https://bmsce.ac.in/home/Post-Graduation",
  "https://bmsce.ac.in/home/International-Admissions",

  //Facilities
  "https://bmsce.ac.in/home/BMS-Hospital",
  "https://bmsce.ac.in/home/About-Library",
  "https://bmsce.ac.in/home/About-BMSET-Hostels",
  "https://bmsce.ac.in/home/About-Data-Center",
  "https://bmsce.ac.in/home/About-Sports",

  //Placements
  "https://bmsce.ac.in/home/About-Placements",
  "https://bmsce.ac.in/home/Placement-Recruiting-Companies",
  

];

export const MAX_DEPTH = 3;      // ✅ Increased
export const MAX_PAGES = 700;   // ✅ Increased
export const DELAY_MS = 500;

export const BLOCKED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
  ".mp4", ".avi", ".mov", ".mp3", ".wav",
  ".css", ".js", ".ico",
];

// ✅ MINIMAL blocking - only system paths
export const BLOCKED_PATH_KEYWORDS = [
  "login", "admin", "dashboard", "wp-admin", "wp-content",
  "/api/", "/cdn-cgi/",
];

// ✅ Allow ALL PDFs (don't filter)
export const ALLOW_ALL_PDFS = true;

export function shouldCrawlUrl(url) {
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes(ROOT_DOMAIN)) {
      return false;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    
    const hasBlockedExt = BLOCKED_EXTENSIONS.some(ext => 
      pathname.endsWith(ext)
    );
    if (hasBlockedExt) return false;
    
    const hasBlockedKeyword = BLOCKED_PATH_KEYWORDS.some(keyword =>
      pathname.includes(keyword.toLowerCase())
    );
    if (hasBlockedKeyword) return false;
    
    return true;
  } catch {
    return false;
  }
}