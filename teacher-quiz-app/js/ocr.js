// Client-side OCR using Tesseract.js — no server or API key needed.

async function extractTextFromImages(files, onProgress) {
  let combined = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) onProgress(`Reading photo ${i + 1} of ${files.length}…`);
    const result = await Tesseract.recognize(file, "eng");
    combined += "\n" + (result.data.text || "");
  }
  return combined.trim();
}
