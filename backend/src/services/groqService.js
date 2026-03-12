import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { readKBRows } from "./sheetService.js";

console.log(process.env.GROK_API_KEY ? "Groq Loaded" : "Groq NOT Loaded");

const groq = new Groq({
  apiKey: process.env.GROK_API_KEY,
});

const MODEL = "moonshotai/kimi-k2-instruct-0905";

function buildPrompt(question, kbData = []) {
  const kbText = kbData.length
    ? kbData
      .map(
        (r, i) =>
          `Source ${i + 1} (${r.content_type.toUpperCase()}):\n${r.text}\n[URL: ${r.source_url}]`
      )
      .join("\n\n")
    : "No knowledge base data available.";


  return `
Role: You are a polite Indian college phone assistant.

<knowledge_base>
${kbText}
</knowledge_base>

<user_question>
${question}
</user_question>

<instructions>
1. Language & Style:
   - Detect the user's language automatically.
   - Reply in the SAME language and style as the user.
   - English → English
   - Hindi → Hindi
   - Hinglish → Hinglish
   - Keep common college terms in English (admission, fees, department, office, website).

2. Tone:
   - Friendly, clear, Indian college BMSCE assistant.
   - Phone-call style.
   - Use simple, concise sentences human like conversation.

3. Answer Rules:
   - Use the knowledge base strictly.
   - If KB does not contain the answer:
     - Provide general guidance.
     - Append only this disclaimer at the end if the info is critical if not no need:
       "Please verify with the college office."

4. Length:
   - 15-40 words.

5. Output:
   - Respond ONLY in valid JSON no matter what:

{
  "answer": string,
  "main_topic": string,
  "intent_level": "LOW" | "MEDIUM" | "HIGH",
  "escalate": boolean,
  "summary_for_staff": string
}
</instructions>
`;
}


export async function askGroq(question) {
  const prompt = buildPrompt(question, readKBRows);

  try {
    const chat = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const txt = chat.choices[0].message.content;

    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error("Groq did not return valid JSON");
    }

    return data;
  } catch (err) {
    console.error("Groq Error:", err.message);

    return {
      answer:
        "Sorry, I am having trouble right now. Please try again or contact the college office.",
      main_topic: "general",
      intent_level: "LOW",
      escalate: true,
      summary_for_staff: `Error: ${err.message}`,
    };
  }
}



