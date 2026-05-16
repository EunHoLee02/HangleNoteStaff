import { DURATION_LABELS, parseHangulNotes } from "./parser.js";
import { A4_PAGE, renderEmptyPage, renderPagedScore } from "./scoreRenderer.js";
import { buildMusicXml } from "./musicXml.js";
import { extractTextFromFile } from "./pdfExtractor.js";

const elements = {
  noteInput: document.querySelector("#noteInput"),
  octaveInput: document.querySelector("#octaveInput"),
  timeSignatureInput: document.querySelector("#timeSignatureInput"),
  durationInput: document.querySelector("#durationInput"),
  tempoInput: document.querySelector("#tempoInput"),
  fileInput: document.querySelector("#fileInput"),
  renderButton: document.querySelector("#renderButton"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  statusMessage: document.querySelector("#statusMessage"),
  scoreCanvas: document.querySelector("#scoreCanvas"),
  scoreSummary: document.querySelector("#scoreSummary"),
  svgButton: document.querySelector("#svgButton"),
  pngButton: document.querySelector("#pngButton"),
  pdfButton: document.querySelector("#pdfButton"),
  musicXmlButton: document.querySelector("#musicXmlButton"),
};

let currentNotes = [];
let currentPageCount = 0;

elements.renderButton.addEventListener("click", render);
elements.sampleButton.addEventListener("click", () => {
  elements.noteInput.value = "도 레 미 파 | 솔 라 시 도' | 도'/2 시 라 솔 | 파 미 레 도 | 도레미파솔라시도 도레미파솔라시도";
  render();
});
elements.clearButton.addEventListener("click", () => {
  elements.noteInput.value = "";
  render();
});
elements.fileInput.addEventListener("change", handleUpload);
elements.svgButton.addEventListener("click", downloadSvg);
elements.pngButton.addEventListener("click", downloadPng);
elements.pdfButton.addEventListener("click", downloadPdf);
elements.musicXmlButton.addEventListener("click", downloadMusicXml);

render();

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus(`${file.name} 파일에서 한글 음계를 읽는 중입니다.`);
  try {
    const extracted = await extractTextFromFile(file);
    if (!extracted.trim()) {
      throw new Error("파일에서 도레미파솔라시도 음계를 찾지 못했습니다.");
    }
    elements.noteInput.value = extracted;
    render();
    setStatus(`${file.name}에서 추출한 음계를 입력창에 반영했습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    event.target.value = "";
  }
}

function getOptions() {
  return {
    baseOctave: Number(elements.octaveInput.value),
    timeSignature: elements.timeSignatureInput.value,
    defaultDuration: elements.durationInput.value,
    tempo: Number(elements.tempoInput.value),
  };
}

function render() {
  const options = getOptions();
  currentNotes = parseHangulNotes(elements.noteInput.value, options);

  if (currentNotes.length === 0) {
    currentPageCount = 0;
    elements.scoreCanvas.innerHTML = `<div class="score-page">${renderEmptyPage()}</div>`;
    elements.scoreSummary.textContent = "변환할 음표가 없습니다.";
    setStatus("도, 레, 미, 파, 솔, 라, 시 또는 쉼을 입력해주세요.", true);
    return;
  }

  const rendered = renderPagedScore(currentNotes, options);
  currentPageCount = rendered.pageCount;
  elements.scoreCanvas.innerHTML = rendered.html;
  const durationName = DURATION_LABELS[options.defaultDuration] ?? "4분음표";
  elements.scoreSummary.textContent = `${currentNotes.length}개 음표, ${currentPageCount}쪽, ${options.timeSignature}, 기본 ${durationName}`;
  setStatus(`A4 ${currentPageCount}쪽 악보와 내보내기를 갱신했습니다.`);
}

function downloadSvg() {
  const svgs = getPageSvgs();
  svgs.forEach((svg, index) => {
    const filename = pageFilename("hangul-note-staff", "svg", index, svgs.length);
    downloadBlob(new XMLSerializer().serializeToString(svg), filename, "image/svg+xml");
  });
}

function downloadMusicXml() {
  if (currentNotes.length === 0) return;
  const xml = buildMusicXml(currentNotes, {
    title: "Korean Solfege Score",
    timeSignature: elements.timeSignatureInput.value,
    tempo: Number(elements.tempoInput.value),
    notesPerPage: A4_PAGE.notesPerPage,
  });
  downloadBlob(xml, "hangul-note-staff.musicxml", "application/vnd.recordare.musicxml+xml");
}

async function downloadPng() {
  const svgs = getPageSvgs();
  for (let index = 0; index < svgs.length; index += 1) {
    const canvas = await svgToCanvas(svgs[index], 2);
    await new Promise((resolve) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) downloadBlob(pngBlob, pageFilename("hangul-note-staff", "png", index, svgs.length), "image/png");
        resolve();
      }, "image/png");
    });
  }
}

async function downloadPdf() {
  const svgs = getPageSvgs();
  if (svgs.length === 0) return;

  try {
    const jsPDF = await loadJsPdf();
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    for (let index = 0; index < svgs.length; index += 1) {
      if (index > 0) pdf.addPage("a4", "portrait");
      const canvas = await svgToCanvas(svgs[index], 2);
      const png = canvas.toDataURL("image/png");
      pdf.addImage(png, "PNG", 0, 0, 595.28, 841.89);
    }

    pdf.save("hangul-note-staff.pdf");
  } catch (error) {
    setStatus(`PDF 생성에 실패했습니다: ${error.message}`, true);
  }
}

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("error", isError);
}

function getPageSvgs() {
  return Array.from(document.querySelectorAll(".score-page-svg"));
}

function pageFilename(base, extension, index, total) {
  if (total === 1) return `${base}.${extension}`;
  return `${base}-page-${String(index + 1).padStart(2, "0")}.${extension}`;
}

async function svgToCanvas(svg, scale = 2) {
  const svgText = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });

  const viewBox = svg.viewBox.baseVal;
  const canvas = document.createElement("canvas");
  canvas.width = viewBox.width * scale;
  canvas.height = viewBox.height * scale;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas;
}

async function loadJsPdf() {
  if (globalThis.jspdf?.jsPDF) return globalThis.jspdf.jsPDF;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("PDF 라이브러리를 불러오지 못했습니다."));
    document.head.append(script);
  });

  if (!globalThis.jspdf?.jsPDF) {
    throw new Error("PDF 라이브러리를 사용할 수 없습니다.");
  }

  return globalThis.jspdf.jsPDF;
}
