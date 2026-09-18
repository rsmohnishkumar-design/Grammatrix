// Client-side text extraction — no server or API key needed.
// Images go through Tesseract.js OCR. PDFs use pdf.js: real text-layer pages
// extract instantly, and any page with no text layer (a scanned page) falls
// back to rendering it as an image and running OCR on that.

async function extractTextFromFiles(files, onProgress) {
  let combined = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === "application/pdf") {
      combined += "\n" + (await extractTextFromPdf(file, i, files.length, onProgress));
    } else {
      if (onProgress) onProgress(`Reading photo ${i + 1} of ${files.length}…`);
      const result = await Tesseract.recognize(file, "eng");
      combined += "\n" + (result.data.text || "");
    }
  }
  return combined.trim();
}

async function extractTextFromPdf(file, fileIndex, totalFiles, onProgress) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    if (onProgress) {
      onProgress(`Reading PDF ${fileIndex + 1} of ${totalFiles} — page ${p} of ${pdf.numPages}…`);
    }
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ").trim();

    if (pageText.length > 20) {
      text += "\n" + pageText;
      continue;
    }

    // No usable text layer — this page is likely a scan. Render it to a
    // canvas and OCR that image instead.
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const result = await Tesseract.recognize(blob, "eng");
    text += "\n" + (result.data.text || "");
  }

  return text.trim();
}
