import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const groq = new Groq({
  apiKey: "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",
});

async function testGroq() {
  const chat = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "user", content: "write a code in c for linked list" }
    ],
  });

  console.log("Groq reply:", chat.choices[0].message.content);
}

testGroq();
