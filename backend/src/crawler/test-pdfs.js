import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  ROOT_DOMAIN: "bmsce.ac.in",
  MAX_DEPTH: 8,
  MAX_PAGES: 500,  // Increased for full crawl
  DELAY_MS: 300,
  
  OUTPUT_DIR: path.join(__dirname, 'debug_output'),
  HTML_DIR: path.join(__dirname, 'debug_output', 'html'),
  PDF_DIR: path.join(__dirname, 'debug_output', 'pdf'),
  LOG_FILE: path.join(__dirname, 'debug_output', 'crawl_log.txt'),
  SUMMARY_FILE: path.join(__dirname, 'debug_output', 'summary.txt'),
  
  START_URLS: [
    "https://bmsce.ac.in",
    "https://bmsce.ac.in/home/About-BMSCE",
    "https://bmsce.ac.in/home/Civil-Engineering",
    "https://bmsce.ac.in/home/About-Admissions",
  ],
  
  BLOCKED_KEYWORDS: [
    "login", "admin", "wp-admin", "wp-content",
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function createDirectories() {
  [CONFIG.OUTPUT_DIR, CONFIG.HTML_DIR, CONFIG.PDF_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  fs.writeFileSync(CONFIG.LOG_FILE, '');
  fs.writeFileSync(CONFIG.SUMMARY_FILE, '');
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  console.log(logLine.trim());
  fs.appendFileSync(CONFIG.LOG_FILE, logLine);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = '';
    return urlObj.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes(CONFIG.ROOT_DOMAIN)) {
      return false;
    }
    
    const pathname = urlObj.pathname.toLowerCase();
    
    const junkExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.ico'];
    if (junkExtensions.some(ext => pathname.endsWith(ext))) {
      return false;
    }
    
    if (CONFIG.BLOCKED_KEYWORDS.some(kw => pathname.includes(kw))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function isPDF(url) {
  return url.toLowerCase().endsWith('.pdf');
}

function sanitizeFilename(url) {
  return url
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 150) + '.txt';
}

function saveHTMLContent(url, html, depth) {
  const $ = cheerio.load(html);
  
  $('script, style, nav, header, footer, .menu, .sidebar, .breadcrumb').remove();
  
  const title = $('title').text().trim() || 'No Title';
  const bodyText = $('body').text();
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();
  
  const links = [];
  $('a[href]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      try {
        const absoluteUrl = new URL(href, url).href;
        links.push(absoluteUrl);
      } catch {}
    }
  });
  
  const content = `
═══════════════════════════════════════════════════════════════
URL: ${url}
DEPTH: ${depth}
TITLE: ${title}
CONTENT LENGTH: ${cleanText.length} characters
LINKS FOUND: ${links.length}
═══════════════════════════════════════════════════════════════

CONTENT:
${cleanText.substring(0, 3000)}
${cleanText.length > 3000 ? '\n... (content truncated, full text above)' : ''}

═══════════════════════════════════════════════════════════════
`;
  
  const filename = sanitizeFilename(url);
  const filepath = path.join(CONFIG.HTML_DIR, filename);
  
  fs.writeFileSync(filepath, content, 'utf-8');
  log(`💾 Saved HTML: ${filename} (${cleanText.length} chars)`);
  
  return { title, textLength: cleanText.length, linksFound: links.length };
}

async function savePDFContent(url, depth) {
  try {
    log(`📄 Found PDF: ${url}`);
    
    const content = `
═══════════════════════════════════════════════════════════════
URL: ${url}
DEPTH: ${depth}
TYPE: PDF
═══════════════════════════════════════════════════════════════

PDF document found!
Install pdf-parse to extract text: npm install pdf-parse
`;
    
    const filename = sanitizeFilename(url);
    const filepath = path.join(CONFIG.PDF_DIR, filename);
    
    fs.writeFileSync(filepath, content, 'utf-8');
    log(`✅ PDF logged: ${filename}`);
    
    return { size: 0 };
  } catch (error) {
    log(`❌ PDF processing failed: ${error.message}`, 'ERROR');
    return null;
  }
}

// ============================================
// BREADTH-FIRST CRAWLER
// ============================================
class BreadthFirstCrawler {
  constructor() {
    this.visited = new Set();
    this.queue = [];  // Queue: [{url, depth}, ...]
    this.stats = {
      totalPages: 0,
      htmlPages: 0,
      pdfPages: 0,
      failedPages: 0,
      skippedInvalid: 0,
      skippedDuplicate: 0,
      totalLinks: 0,
      pagesByDepth: {},
    };
  }

  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.data;
    } catch (error) {
      log(`❌ Failed to fetch ${url}: ${error.message}`, 'ERROR');
      this.stats.failedPages++;
      return null;
    }
  }

  extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = new Set();
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        const normalized = normalizeUrl(absoluteUrl);
        
        if (normalized && isValidUrl(normalized)) {
          links.add(normalized);
        }
      } catch {}
    });
    
    return Array.from(links);
  }

  async crawlPage(url, depth) {
    const normalized = normalizeUrl(url);
    if (!normalized) return [];
    
    if (this.visited.has(normalized)) {
      this.stats.skippedDuplicate++;
      return [];
    }
    
    if (!isValidUrl(normalized)) {
      this.stats.skippedInvalid++;
      return [];
    }
    
    this.visited.add(normalized);
    this.stats.totalPages++;
    this.stats.pagesByDepth[depth] = (this.stats.pagesByDepth[depth] || 0) + 1;
    
    log(`🔍 [${this.visited.size}/${CONFIG.MAX_PAGES}] depth:${depth} ${normalized}`);
    
    await sleep(CONFIG.DELAY_MS);
    
    try {
      // Handle PDFs
      if (isPDF(normalized)) {
        const pdfInfo = await savePDFContent(normalized, depth);
        if (pdfInfo) {
          this.stats.pdfPages++;
        }
        return []; // PDFs have no links
      }
      
      // Handle HTML
      const html = await this.fetchPage(normalized);
      if (!html) return [];
      
      const pageInfo = saveHTMLContent(normalized, html, depth);
      this.stats.htmlPages++;
      this.stats.totalLinks += pageInfo.linksFound;
      
      // Extract links for next depth
      const links = this.extractLinks(html, normalized);
      log(`   → Found ${links.length} valid links`);
      
      return links;
      
    } catch (error) {
      log(`❌ Error crawling ${normalized}: ${error.message}`, 'ERROR');
      this.stats.failedPages++;
      return [];
    }
  }

  async start() {
    log('🚀 Starting breadth-first crawler...');
    
    // Initialize queue with start URLs at depth 0
    for (const url of CONFIG.START_URLS) {
      this.queue.push({ url, depth: 0 });
    }
    
    // Process queue breadth-first
    while (this.queue.length > 0 && this.visited.size < CONFIG.MAX_PAGES) {
      const { url, depth } = this.queue.shift();  // Take from front (BFS)
      
      if (depth > CONFIG.MAX_DEPTH) {
        log(`⏭️  Skipped (max depth): ${url}`, 'SKIP');
        continue;
      }
      
      // Crawl this page and get child links
      const childLinks = await this.crawlPage(url, depth);
      
      // Add child links to queue at next depth
      for (const link of childLinks) {
        this.queue.push({ url: link, depth: depth + 1 });
      }
      
      // Log progress
      if (this.visited.size % 10 === 0) {
        log(`📊 Progress: ${this.visited.size} pages, ${this.queue.length} in queue`);
      }
    }
    
    this.writeSummary();
    log('✅ Crawl complete!');
  }

  writeSummary() {
    const summary = `
═══════════════════════════════════════════════════════════════
                    CRAWL SUMMARY
═══════════════════════════════════════════════════════════════

Configuration:
  MAX_DEPTH: ${CONFIG.MAX_DEPTH}
  MAX_PAGES: ${CONFIG.MAX_PAGES}
  ROOT_DOMAIN: ${CONFIG.ROOT_DOMAIN}

Results:
  Total pages visited: ${this.stats.totalPages}
  HTML pages: ${this.stats.htmlPages}
  PDF pages: ${this.stats.pdfPages}
  Failed pages: ${this.stats.failedPages}
  Skipped (duplicate): ${this.stats.skippedDuplicate}
  Skipped (invalid): ${this.stats.skippedInvalid}
  Total links found: ${this.stats.totalLinks}

Pages by depth:
${Object.entries(this.stats.pagesByDepth)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .map(([depth, count]) => `  Depth ${depth}: ${count} pages`)
  .join('\n')}

Output locations:
  HTML files: ${CONFIG.HTML_DIR}
  PDF files: ${CONFIG.PDF_DIR}
  Log file: ${CONFIG.LOG_FILE}

═══════════════════════════════════════════════════════════════
`;
    
    fs.writeFileSync(CONFIG.SUMMARY_FILE, summary, 'utf-8');
    console.log(summary);
  }
}

// ============================================
// RUN
// ============================================
async function main() {
  createDirectories();
  const crawler = new BreadthFirstCrawler();
  await crawler.start();
}

main();