import { DURATION_LABELS, parseHangulNotes } from "./parser.js";
import { renderStaffSvg } from "./scoreRenderer.js";
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
  musicXmlButton: document.querySelector("#musicXmlButton"),
};

let currentNotes = [];

elements.renderButton.addEventListener("click", render);
elements.sampleButton.addEventListener("click", () => {
  elements.noteInput.value = "도 레 미 파 | 솔 라 시 도' | 도'/2 시 라 솔 | 파 미 레 도";
  render();
});
elements.clearButton.addEventListener("click", () => {
  elements.noteInput.value = "";
  render();
});
elements.fileInput.addEventListener("change", handleUpload);
elements.svgButton.addEventListener("click", downloadSvg);
elements.pngButton.addEventListener("click", downloadPng);
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
    elements.scoreCanvas.innerHTML = emptySvg();
    elements.scoreSummary.textContent = "변환할 음표가 없습니다.";
    setStatus("도, 레, 미, 파, 솔, 라, 시 또는 쉼을 입력해주세요.", true);
    return;
  }

  elements.scoreCanvas.innerHTML = renderStaffSvg(currentNotes, options);
  const durationName = DURATION_LABELS[options.defaultDuration] ?? "4분음표";
  elements.scoreSummary.textContent = `${currentNotes.length}개 음표, ${options.timeSignature}, 기본 ${durationName}`;
  setStatus("오선보와 MusicXML 내보내기를 갱신했습니다.");
}

function downloadSvg() {
  const svg = document.querySelector("#scoreSvg");
  if (!svg) return;
  downloadBlob(new XMLSerializer().serializeToString(svg), "hangul-note-staff.svg", "image/svg+xml");
}

function downloadMusicXml() {
  if (currentNotes.length === 0) return;
  const xml = buildMusicXml(currentNotes, {
    title: "Hangul Note Staff Score",
    timeSignature: elements.timeSignatureInput.value,
    tempo: Number(elements.tempoInput.value),
  });
  downloadBlob(xml, "hangul-note-staff.musicxml", "application/vnd.recordare.musicxml+xml");
}

async function downloadPng() {
  const svg = document.querySelector("#scoreSvg");
  if (!svg) return;

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

  const canvas = document.createElement("canvas");
  const viewBox = svg.viewBox.baseVal;
  canvas.width = viewBox.width * 2;
  canvas.height = viewBox.height * 2;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fffefa";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  canvas.toBlob((pngBlob) => {
    if (pngBlob) downloadBlob(pngBlob, "hangul-note-staff.png", "image/png");
  }, "image/png");
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

function emptySvg() {
  return `<svg id="scoreSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 260" role="img" aria-label="빈 악보">
    <rect width="760" height="260" fill="#fffefa"/>
    <text x="380" y="130" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="18" fill="#697579">한글 음계를 입력하면 악보가 표시됩니다.</text>
  </svg>`;
}
