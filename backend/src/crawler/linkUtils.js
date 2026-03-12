import {
  ROOT_DOMAIN,
  BLOCKED_EXTENSIONS,
  BLOCKED_PATH_KEYWORDS
} from "./config.js";

export function isValidLink(url) {
  try {
    const parsed = new URL(url);

    // allow all subdomains
    if (!parsed.hostname.endsWith(ROOT_DOMAIN)) return false;

    // block extensions
    if (BLOCKED_EXTENSIONS.some(ext =>
      parsed.pathname.toLowerCase().endsWith(ext)
    )) return false;

    // block internal portals
    if (BLOCKED_PATH_KEYWORDS.some(word =>
      parsed.pathname.toLowerCase().includes(word)
    )) return false;

    return true;
  } catch {
    return false;
  }
}
