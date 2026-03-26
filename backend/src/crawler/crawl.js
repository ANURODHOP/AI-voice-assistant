import axios from "axios";
import * as cheerio from "cheerio";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import { ROOT_DOMAIN, BLOCKED_EXTENSIONS, BLOCKED_PATH_KEYWORDS } from "./config.js";

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
  if (!isAllowedUrl(url)) return null;

  let res;
  try {
    res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } catch (err) {
    console.log(`❌ Axios error: ${err.message}`);
    return null;
  }

  const contentType = res.headers["content-type"] || "";
  const isPDF = contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf");
  const isHTML = contentType.includes("text/html");

  /* 🟢 HTML PAGE */
  if (isHTML) {
    const html = res.data.toString("utf-8");
    const $ = cheerio.load(html);

    // ✅ Remove navigation but keep main content
    $("script, style, nav, header, footer, .menu, .sidebar, .breadcrumb").remove();

    const text = $("body").text().replace(/\s+/g, " ").trim();
    const links = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const absolute = new URL(href, url).href;
        if (isAllowedUrl(absolute)) links.push(absolute);
      } catch {}
    });

    return { content_type: "html", text, links };
  }

  /* 🟡 PDF FILE */
  if (isPDF) {
    // ✅ ALLOW ALL PDFs - NO KEYWORD FILTERING
    console.log(`📄 Processing PDF: ${url}`);

    try {
      const buffer = Buffer.from(res.data);
      
      const loadingTask = getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      console.log(`   📄 PDF pages: ${pdfDoc.numPages}`);

      let text = "";
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + " ";
      }

      text = text.replace(/\s+/g, " ").trim();

      if (text.length < 100) {
        console.log("   ⚠️ Skipped: Image-only PDF");
        fs.appendFileSync("skipped_pdfs.log", url + "\n");
        return null;
      }

      console.log(`   ✅ PDF extracted: ${text.length} chars`);
      return { content_type: "pdf", text, links: [] };

    } catch (error) {
      console.error(`   💥 PDF failed: ${error.message}`);
      return null;
    }
  }

  return null;
}