import axios from "axios";
import * as cheerio from "cheerio";
import { extractTextWithOCR } from "./pdfOcr.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  ROOT_DOMAIN,
  BLOCKED_EXTENSIONS,
  BLOCKED_PATH_KEYWORDS,
  ALLOWED_PDF_KEYWORDS
} from "./config.js";

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(ROOT_DOMAIN)) return false;
    if (BLOCKED_EXTENSIONS.some(ext => u.pathname.toLowerCase().endsWith(ext))) return false;
    if (BLOCKED_PATH_KEYWORDS.some(k => u.pathname.toLowerCase().includes(k))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function crawlResource(url) {
  // if (!isAllowedUrl(url)) return null;

  let res;
  try {
    res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
    });
    console.log(`📡 HTTP ${res.status} | Content-Type: ${res.headers["content-type"]} | Size: ${res.data.byteLength} bytes`);
  } catch (err) {
    console.log(`❌ Axios error: [${err.code}] ${err.message}`);
    if (err.response) {
      console.log(`   → Server responded with HTTP ${err.response.status}`);
    }
    return null;
  }

  const contentType = res.headers["content-type"] || "";

  /* 🟢 HTML PAGE */
  if (contentType.includes("text/html")) {
    const html = res.data.toString("utf-8");
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, noscript").remove();

    const text = $("body").text().replace(/\s+/g, " ").trim();
    const links = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const absolute = new URL(href, url).href;
      if (isAllowedUrl(absolute)) links.push(absolute);
    });

    return { content_type: "html", text, links };
  }

  /* 🟡 PDF FILE */
  if (contentType.includes("application/pdf")) {
    // const lowerUrl = url.toLowerCase();
    // if (!ALLOWED_PDF_KEYWORDS.some(k => lowerUrl.includes(k))) return null;

    try {
      const buffer = Buffer.from(res.data);
      let text = "";

      /* ---------- TRY NORMAL PARSE ---------- */
      try {
        const loadingTask = getDocument({ data: new Uint8Array(buffer) });
        const pdfDoc = await loadingTask.promise;
        console.log(`📄 PDF pages: ${pdfDoc.numPages}`);

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(" ") + " ";
        }

        text = text.replace(/\s+/g, " ").trim();
        console.log(`📝 Extracted text length: ${text.length} chars`);
        if (text.length > 200) console.log("✅ Parsed PDF normally");

      } catch (err) {
        console.log(`⚠️ pdf parse failed: ${err.message}`);
      }

      /* ---------- OCR FALLBACK ---------- */
      if (text.length < 200) {
        console.log("🔎 Running OCR for:", url);
        text = await extractTextWithOCR(buffer);
        console.log(`🔎 OCR text length: ${text.length} chars`);
      }

      if (text.length < 200) {
        console.log("⚠️ No usable text extracted");
        return null;
      }

      return { content_type: "pdf", text, links: [] };

    } catch (error) {
      console.error(`💥 PDF block failed: ${error.message}`);
      return null;
    }
  }

  console.log(`⚠️ Unhandled content-type: "${contentType}" — returning null`);
  return null;
}