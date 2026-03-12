import os
import json
from google import genai
from google.genai import types

os.environ["GEMINI_API_KEY"] = "AIzaSyDcTWX5P8CTuAN-5VMeI0YQfauhP883LC4"
# 1. Setup Client
# Ensure your API key is in your environment variables or paste it here directly for a quick test
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

MODEL_ID = "gemini-2.5-flash"

def build_prompt(question, language, kb_matches=None):
    lang_name = "Hindi" if language == "hi" else "English"
    
    # Format KB matches
    if kb_matches:
        kb_text = "\n\n".join([f"KB{i+1}_Q: {r['question']}\nKB{i+1}_A: {r['answer']}" for i, r in enumerate(kb_matches)])
    else:
        kb_text = "NO_KB_MATCHES"

    return f"""
You are a polite college phone assistant. Keep answers concise (approx 15-40 words).
Use the KB context when present. If context is NOT present, answer using general 2024-2025 academic guidance but always add "Please verify with the college office."

Language: {lang_name}.
KB context:
{kb_text}

User question:
\"\"\"{question}\"\"\"

Return STRICT JSON ONLY:
{{
  "answer": "text to say to caller",
  "main_topic": "admission|fee|hostel|office|complaint|general",
  "intent_level": "LOW|MEDIUM|HIGH",
  "escalate": true,
  "summary_for_staff": "short summary"
}}
"""

def ask_gemini_with_kb(question, language, kb_matches=None):
    prompt = build_prompt(question, language, kb_matches or [])
    
    try:
        # Using generate_content with JSON constraint
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        # Parse and return the JSON
        return json.loads(response.text)

    except Exception as e:
        print(f"Error occurred: {e}")
        return None

# --- Example Usage ---
if __name__ == "__main__":
    # Mock KB Data
    mock_kb = [
        {"question": "What is the CS fee?", "answer": "The fee for Computer Science is 1.2 Lakhs per annum."}
    ]
    
    print("Testing Gemini...")
    result = ask_gemini_with_kb("How much is the computer science fee?", "en", mock_kb)
    
    if result:
        print(json.dumps(result, indent=2))