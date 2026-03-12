import { GoogleGenerativeAI } from "@google/generative-ai";
import './src/config/env.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log(`Gemini api key : ${process.env.GEMINI_API_KEY}`);

async function test() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent("Say hello");
  console.log(result.response.text());
}

test();
