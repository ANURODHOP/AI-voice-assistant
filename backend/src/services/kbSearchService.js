// KbSearchService.js
import { readKBRows } from "./sheetService.js";

const STOPWORDS = new Set([
  "what", "is", "the", "of", "and", "to", "for", "in", "on", "a", "an"
]);

export async function findTopKBMatches(userQuestion, topN = 5) {
  let rows = [];
  try {
    rows = await readKBRows();
  } catch (err) {
    console.warn("⚠️ KB disabled (sheet read failed)");
    rows = [];
  }

  const q = (userQuestion || "").toLowerCase();

  const tokens = q
    .split(/\W+/)
    .filter(t => t && !STOPWORDS.has(t));

  const scored = rows.map((row, idx) => {
    const [question = "", answer = "", category = "", keywords = ""] = row;

    const qText = question.toLowerCase();
    const kText = keywords.toLowerCase();
    const cText = category.toLowerCase();

    let score = 0;

    for (const t of tokens) {
      if (kText.includes(t)) score += 4;   // 🔥 keywords strongest
      if (qText.includes(t)) score += 2;
      if (cText.includes(t)) score += 1;
    }

    return { idx, question, answer, category, keywords, score };
  });

  const top = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return top;
}
