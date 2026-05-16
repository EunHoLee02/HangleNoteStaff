import { extractHangulNoteText } from "./parser.js";

export async function extractTextFromFile(file) {
  if (!file) return "";
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return file.text();
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractTextFromPdf(file);
  }

  throw new Error("PDF 또는 TXT 파일만 지원합니다.");
}

async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdfjs = await loadPdfJs();

  if (pdfjs?.getDocument) {
    const worker = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str).join(" "));
    }

    return extractHangulNoteText(pageTexts.join("\n"));
  }

  const fallback = decodePdfTextLayer(buffer);
  if (fallback.trim()) return extractHangulNoteText(fallback);
  throw new Error("PDF 텍스트 추출 모듈을 불러오지 못했습니다. 텍스트가 있는 PDF인지 확인해주세요.");
}

async function loadPdfJs() {
  if (globalThis.pdfjsLib?.getDocument) return globalThis.pdfjsLib;

  try {
    return await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  } catch {
    return null;
  }
}

function decodePdfTextLayer(buffer) {
  const uint8 = new Uint8Array(buffer);
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(uint8);
  const literalText = Array.from(utf8Text.matchAll(/\(([^)]{1,300})\)/g))
    .map((match) => match[1])
    .join(" ");

  return literalText || utf8Text;
}
