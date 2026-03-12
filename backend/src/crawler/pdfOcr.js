import { fromBuffer } from "pdf2pic";
import Tesseract from "tesseract.js";

export async function extractTextWithOCR(buffer) {
  try {
    const converter = fromBuffer(buffer, {
      density: 300,
      format: "png",
      width: 2000,
      height: 2000
    });

    const pages = await converter.bulk(-1);

    let text = "";

    for (const page of pages) {
      const { data } = await Tesseract.recognize(page.path, "eng");
      text += " " + data.text;
    }

    return text.replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("OCR failed:", err.message);
    return "";
  }
}