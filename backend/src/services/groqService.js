import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import { readKBRows } from "./sheetService.js";
import { semanticSearch, buildContext, getSources } from './vectorRagService.js';
// ✅ NEW: Import session service
import { getConversationContext } from './sessionService.js';

console.log(process.env.GROK_API_KEY ? "Groq Loaded" : "Groq NOT Loaded");

const groq = new Groq({
  apiKey: process.env.GROK_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";

const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  // "llama-3.1-70b-versatile", 
  // "mixtral-8x7b-32768",
  // "llama-3.1-8b-instant",
];

// ✅ NEW: Expand abbreviations to full forms
// ✅ FIXED: Expand abbreviations to full forms
function expandQuery(question) {
  let expanded = question;

  const expansions = {
    // Department abbreviations
    'AIML': 'Artificial Intelligence Machine Learning AI ML AI&ML',
    'CSE': 'Computer Science Engineering CS',
    'ISE': 'Information Science Engineering IS',
    'ECE': 'Electronics Communication Engineering EC',
    'EEE': 'Electrical Electronics Engineering',
    'ME': 'Mechanical Engineering',
    'Civil': 'Civil Engineering',
    'EIE': 'Electronics Instrumentation Engineering',
    'TCE': 'Telecommunication Engineering',
    'BT': 'Biotechnology Bio Technology',
    'Chem': 'Chemical Engineering Chemistry',
    'IEM': 'Industrial Engineering Management',

    // Role abbreviations
    'HOD': 'Head of Department HoD Professor Chair Faculty',
    'HRD': 'Human Resource Development',
    'Principal': 'Director Principal Head',

    // Common abbreviations
    'fees': 'fee fees cost tuition payment',
    'hostel': 'hostel accommodation residence dormitory PG',
    'placement': 'placement job recruitment career companies',
    'admission': 'admission eligibility application registration enrollment',
    'branch': 'branch department stream course program',
  };

  // Track what was expanded (for logging)
  const expandedTerms = [];

  // Apply expansions
  for (const [abbr, fullForm] of Object.entries(expansions)) {
    // Case-insensitive check
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    if (regex.test(question)) {
      expanded += ` ${fullForm}`;
      expandedTerms.push(abbr);
    }
  }

  // Log what was expanded
  if (expandedTerms.length > 0) {
    console.log(`📝 Query expanded: "${question}"`);
    console.log(`   → Added: ${expandedTerms.join(', ')}`);
  }

  return expanded;
}

// ✅ CHANGED: Accept conversationContext as third param
function buildPrompt(question, kbData = [], conversationContext = '') {
  const kbText = kbData.length
    ? kbData
      .map(
        (r, i) =>
          `Source ${i + 1} (${r.content_type.toUpperCase()}):\n${r.text}\n[URL: ${r.source_url}]`
      )
      .join("\n\n")
    : "No knowledge base data available.";

  // ✅ NEW: Build conversation history block
  const historyBlock = conversationContext
    ? `<conversation_history>\n${conversationContext}\n</conversation_history>\n`
    : '';

  return `
Role: You are a friendly, helpful phone assistant for BMSCE (BMS College of Engineering). Give direct answers when you have the information. Only ask for clarification when the question is genuinely unclear.

<knowledge_base>
${kbText}
</knowledge_base>

${historyBlock}
<user_question>
${question}
</user_question>

<critical_rules>

1. ANSWER FIRST, ASK LATER:
   - If the knowledge base has relevant information, ANSWER IMMEDIATELY
   - Only ask clarifying questions if the query is genuinely ambiguous AND you have no relevant info
   - Always respond ONLY in English language using English alphabet.
Do NOT use Devanagari script or any non-English script under any condition. If the user speaks in Hindi, respond in Hinglish (Hindi words in English letters).
   
2. DEPARTMENT NAME VARIATIONS:
   - Recognize that departments have multiple names:
     • AIML = Artificial Intelligence and Machine Learning = AI & ML = Machine Learning
     • CSE = Computer Science and Engineering = Computer Science
     • ISE = Information Science and Engineering
   - If you find information about "Machine Learning department", that's the same as AIML
   - If asked "HOD of AIML", search for Head of Artificial Intelligence, Machine Learning, AI & ML, etc.

3. WHEN TO ASK FOR CLARIFICATION:
   - ONLY ask if:
     (a) The question is truly vague ("fees" with no course mentioned)
     (b) AND you have information for multiple options
     (c) AND the user hasn't already specified
   - Don't ask "which department?" if you can infer from common abbreviations

4. WHEN INFORMATION IS NOT FOUND:
   - Be honest: "I don't have information about [topic] in my records."
   - Give helpful alternatives: "Please contact the [department] office or call +918087654321."
   - Don't suggest wrong departments (e.g., don't suggest IEM for AIML)

5. BE CONCISE:
   - 15-40 words maximum
   - Get to the point
   - Voice assistant - keep it brief

6. USE CONVERSATION HISTORY:
   - If the user sends a short/vague message like just a department name (e.g. "AIML?"),
     check the previous question in <conversation_history>
   - If the previous question was about fees, assume they want fees for the new department too
   - Carry forward the same intent (fees, HOD, placement, etc.) unless the user says otherwise

</critical_rules>

<examples>

Q: "Who is HOD of AIML?"
If found: "Dr. [Name] is the Head of the Artificial Intelligence and Machine Learning department."
If not found: "I don't have the current HOD details for AIML. Please contact the department office at +918087654321."

Q: "HOD of Machine Learning"
Same as AIML, should give same answer

Q: "Head of CSE"
A: "Dr. Kavitha Sooda is the Professor & Head of Computer Science and Engineering at BMSCE."

Q: "CSE HOD"
A: "Dr. Kavitha Sooda is the Head of the CSE department."

</examples>

<output_format>
Respond ONLY in valid JSON:

{
  "answer": "Direct, helpful answer in 15-40 words",
  "main_topic": "admission | fees | hostel | placement | faculty | general",
  "intent_level": "LOW" | "MEDIUM" | "HIGH",
  "escalate": false,
  "summary_for_staff": "Brief summary"
}
</output_format>
`;
}

async function callGroqWithRetry(messages, modelIndex = 0, retryCount = 0) {
  const maxRetries = 3;
  const currentModel = FALLBACK_MODELS[modelIndex] || FALLBACK_MODELS[0];

  try {
    console.log(`🤖 Using model: ${currentModel}`);

    const chat = await groq.chat.completions.create({
      model: currentModel,
      temperature: 0.3,
      messages: messages,
      max_tokens: 500,
    });

    return chat.choices[0].message.content;

  } catch (err) {
    const errorMessage = err.message || JSON.stringify(err);

    if (errorMessage.includes('503') || errorMessage.includes('over capacity')) {
      console.error(`❌ Model ${currentModel} is overloaded`);

      if (modelIndex < FALLBACK_MODELS.length - 1) {
        console.log(`🔄 Trying fallback model...`);
        return await callGroqWithRetry(messages, modelIndex + 1, 0);
      }

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ Retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return await callGroqWithRetry(messages, 0, retryCount + 1);
      }
    }

    throw err;
  }
}

// ✅ CHANGED: Accept sessionId param
export async function askGroq(question, sessionId = null) {
  let kbData = [];

  try {
    const expandedQuery = expandQuery(question);
    const relevantChunks = await semanticSearch(expandedQuery, 10);

    if (relevantChunks.length > 0) {
      console.log(`🔍 Found ${relevantChunks.length} relevant chunks (${(relevantChunks[0].similarity * 100).toFixed(1)}% match)`);

      kbData = relevantChunks.map(chunk => ({
        text: chunk.text,
        source_url: chunk.source_url,
        content_type: chunk.content_type || 'html'
      }));
    } else {
      console.log('⚠️  No relevant chunks found, falling back to sheet data');
      kbData = readKBRows;
    }
  } catch (error) {
    console.error('❌ Vector search failed, using generic data:', error.message);
    kbData = readKBRows;
  }

  // ✅ NEW: Fetch conversation history for this session
  const conversationContext = sessionId ? getConversationContext(sessionId) : '';
  if (conversationContext) {
    console.log(`💬 Including ${conversationContext.split('\n').length} history lines for session ${sessionId}`);
  }

  // ✅ CHANGED: Pass conversationContext to buildPrompt
  const prompt = buildPrompt(question, kbData, conversationContext);

  try {
    const txt = await callGroqWithRetry([{ role: "user", content: prompt }]);

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
        "I'm having some technical trouble right now. Could you please try again in a moment?",
      main_topic: "error",
      intent_level: "LOW",
      escalate: false,
      summary_for_staff: `Error: ${err.message}`,
    };
  }
}