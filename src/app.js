import { DURATION_LABELS, parseHangulNotes } from "./parser.js";
import { A4_PAGE, renderEmptyPage, renderPagedScore } from "./scoreRenderer.js";
import { buildMusicXml } from "./musicXml.js";
import { readMusicXmlBlob, readMusicXmlFile } from "./musicXmlImporter.js";
import { extractTextFromFile } from "./pdfExtractor.js";

const elements = {
  noteInput: document.querySelector("#noteInput"),
  octaveInput: document.querySelector("#octaveInput"),
  timeSignatureInput: document.querySelector("#timeSignatureInput"),
  durationInput: document.querySelector("#durationInput"),
  tempoInput: document.querySelector("#tempoInput"),
  fileInput: document.querySelector("#fileInput"),
  musicXmlImportInput: document.querySelector("#musicXmlImportInput"),
  omrEndpointInput: document.querySelector("#omrEndpointInput"),
  omrEndpointLabel: document.querySelector("#omrEndpointLabel"),
  omrEngineInput: document.querySelector("#omrEngineInput"),
  omrFileInput: document.querySelector("#omrFileInput"),
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
let selectedNoteId = null;

const savedOmrEndpoint = localStorage.getItem("hangul-note-staff.omrEndpoint");
const defaultOmrEndpoint = getDefaultOmrEndpoint();
elements.omrEndpointInput.value = savedOmrEndpoint || defaultOmrEndpoint;
elements.omrEndpointLabel.textContent = `OMR 서버: ${elements.omrEndpointInput.value}`;
elements.omrEndpointInput.addEventListener("change", () => {
  const endpoint = elements.omrEndpointInput.value.trim() || defaultOmrEndpoint;
  elements.omrEndpointInput.value = endpoint;
  localStorage.setItem("hangul-note-staff.omrEndpoint", endpoint);
  elements.omrEndpointLabel.textContent = `OMR 서버: ${endpoint}`;
});

elements.renderButton.addEventListener("click", render);
elements.sampleButton.addEventListener("click", () => {
  elements.noteInput.value = [
    "|: 도/1 | 레/2 미/4 파/8 솔/16 | 라/36 시. 도' | 도~ 도 레( 미 파) :|",
    "도# 레b 미= 파> | 솔_ 라! 시tr 도'g | 쉼/4 도% 레f2 미Fine ||",
  ].join("\n");
  render();
});
elements.clearButton.addEventListener("click", () => {
  elements.noteInput.value = "";
  render();
});
elements.fileInput.addEventListener("change", handleUpload);
elements.musicXmlImportInput.addEventListener("change", handleMusicXmlImport);
elements.omrFileInput.addEventListener("change", handleOmrUpload);
elements.svgButton.addEventListener("click", downloadSvg);
elements.pngButton.addEventListener("click", downloadPng);
elements.pdfButton.addEventListener("click", downloadPdf);
elements.musicXmlButton.addEventListener("click", downloadMusicXml);
elements.scoreCanvas.addEventListener("click", handleScoreClick);
elements.scoreCanvas.addEventListener("keydown", handleScoreKeydown);

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

async function handleMusicXmlImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus(`${file.name} MusicXML을 읽는 중입니다.`);
  try {
    const imported = await readMusicXmlFile(file);
    applyImportedScore(imported, `${file.name} MusicXML`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    event.target.value = "";
  }
}

async function handleOmrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const endpoint = getOmrEndpoint();
  if (!endpoint) {
    setStatus("OMR 서버를 찾지 못했습니다. OMR 서버 설정에서 주소를 확인해주세요.", true);
    event.target.value = "";
    return;
  }

  localStorage.setItem("hangul-note-staff.omrEndpoint", endpoint);
  setStatus(`${file.name} 파일을 OMR 서버로 보내는 중입니다.`);

  try {
    const imported = await requestOmr(endpoint, file);
    applyImportedScore(imported, `${file.name} OMR 결과`);
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

function getOmrEndpoint() {
  const endpoint = elements.omrEndpointInput.value.trim() || defaultOmrEndpoint;
  elements.omrEndpointInput.value = endpoint;
  elements.omrEndpointLabel.textContent = `OMR 서버: ${endpoint}`;
  return endpoint;
}

function getDefaultOmrEndpoint() {
  const configured = document.querySelector('meta[name="omr-endpoint"]')?.content?.trim();
  if (configured) return configured;

  const host = globalThis.location?.hostname ?? "";
  const protocol = globalThis.location?.protocol ?? "http:";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8080/omr/jobs";
  }

  return `${protocol}//${globalThis.location.host}/api/omr/jobs`;
}

function applyImportedScore(imported, sourceName) {
  if (imported.timeSignature) {
    setSelectValue(elements.timeSignatureInput, imported.timeSignature);
  }
  if (imported.tempo) {
    elements.tempoInput.value = imported.tempo;
  }

  elements.noteInput.value = imported.sourceText;
  const parsedSourceNotes = parseHangulNotes(imported.sourceText, getOptions());
  currentNotes = imported.notes.map((note, index) => ({
    ...note,
    sourceStart: parsedSourceNotes[index]?.sourceStart,
    sourceEnd: parsedSourceNotes[index]?.sourceEnd,
  }));
  drawScore(getOptions(), `${sourceName}을 불러왔습니다. 틀린 음표는 악보에서 클릭해 바로 수정할 수 있습니다.`);
}

async function requestOmr(endpoint, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("engine", elements.omrEngineInput.value || "auto");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readOmrError(response));
  }

  return resolveOmrResponse(response, endpoint);
}

async function readOmrError(response) {
  const fallback = `OMR 서버 요청이 실패했습니다. (${response.status})`;
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      const detail = payload.detail || payload.error;
      return detail ? `${fallback}: ${detail}` : fallback;
    }

    const text = await response.text();
    return text.trim() ? `${fallback}: ${text.trim().slice(0, 500)}` : fallback;
  } catch {
    return fallback;
  }
}

async function resolveOmrResponse(response, endpoint) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return resolveOmrJson(await response.json(), endpoint);
  }

  if (contentType.includes("xml") || contentType.includes("zip") || contentType.includes("octet-stream")) {
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="?([^"]+)"?/i)?.[1] ?? "omr-result.musicxml";
    return readMusicXmlBlob(await response.blob(), filename);
  }

  const text = await response.text();
  if (text.trim().startsWith("<")) {
    return readMusicXmlBlob(new Blob([text], { type: "application/xml" }), "omr-result.musicxml");
  }

  throw new Error("OMR 서버 응답에서 MusicXML 결과를 찾지 못했습니다.");
}

async function resolveOmrJson(payload, endpoint) {
  if (payload.musicXml) {
    return readMusicXmlBlob(new Blob([payload.musicXml], { type: "application/xml" }), "omr-result.musicxml");
  }

  const resultUrl = payload.musicXmlUrl ?? payload.mxlUrl ?? payload.resultUrl;
  if (resultUrl) {
    return fetchMusicXmlResult(resultUrl);
  }

  if (payload.status === "queued" || payload.status === "processing" || payload.jobId) {
    return pollOmrJob(payload.statusUrl ?? buildJobStatusUrl(endpoint, payload.jobId));
  }

  throw new Error("OMR 서버 JSON 응답에 musicXml, musicXmlUrl, jobId 중 하나가 필요합니다.");
}

async function pollOmrJob(statusUrl) {
  if (!statusUrl) {
    throw new Error("OMR 작업 상태를 확인할 URL이 없습니다.");
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (attempt > 0) await delay(2000);

    const response = await fetch(statusUrl);
    if (!response.ok) {
      throw new Error(`OMR 작업 상태 확인이 실패했습니다. (${response.status})`);
    }

    const payload = await response.json();
    if (payload.status === "failed" || payload.error) {
      throw new Error(payload.error ?? "OMR 작업이 실패했습니다.");
    }
    if (payload.status === "done" || payload.status === "completed" || payload.musicXml || payload.musicXmlUrl || payload.mxlUrl || payload.resultUrl) {
      return resolveOmrJson(payload, statusUrl);
    }

    setStatus(`OMR 서버가 악보를 분석하는 중입니다. (${attempt + 1}/30)`);
  }

  throw new Error("OMR 작업 시간이 너무 오래 걸립니다. 잠시 후 다시 시도해주세요.");
}

async function fetchMusicXmlResult(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OMR 결과 파일을 가져오지 못했습니다. (${response.status})`);
  }

  const filename = url.split("/").pop() || "omr-result.musicxml";
  return readMusicXmlBlob(await response.blob(), filename);
}

function buildJobStatusUrl(endpoint, jobId) {
  if (!jobId) return "";
  return `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(jobId)}`;
}

function setSelectValue(select, value) {
  if (Array.from(select.options).some((option) => option.value === value)) {
    select.value = value;
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function render() {
  const options = getOptions();
  currentNotes = parseHangulNotes(elements.noteInput.value, options);
  selectedNoteId = null;
  drawScore(options);
}

function drawScore(options, successMessage) {
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
  syncSelectedNote();
  const durationName = DURATION_LABELS[options.defaultDuration] ?? "4분음표";
  elements.scoreSummary.textContent = `${currentNotes.length}개 음표, ${currentPageCount}쪽, ${options.timeSignature}, 기본 ${durationName}, 한 줄 최대 4마디`;
  setStatus(successMessage ?? `A4 ${currentPageCount}쪽 악보와 내보내기를 갱신했습니다.`);
}

function handleScoreClick(event) {
  const noteElement = event.target.closest(".score-note");
  if (!noteElement || !elements.scoreCanvas.contains(noteElement)) return;
  editNoteById(noteElement.dataset.noteId);
}

function handleScoreKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const noteElement = event.target.closest(".score-note");
  if (!noteElement || !elements.scoreCanvas.contains(noteElement)) return;
  event.preventDefault();
  editNoteById(noteElement.dataset.noteId);
}

function editNoteById(noteId) {
  const note = currentNotes.find((candidate) => candidate.id === noteId);
  if (!note || !Number.isInteger(note.sourceStart) || !Number.isInteger(note.sourceEnd)) {
    setStatus("선택한 음표의 원문 위치를 찾지 못했습니다. 입력창에서 직접 수정해 주세요.", true);
    return;
  }

  selectedNoteId = noteId;
  syncSelectedNote();

  const replacement = prompt("선택한 음표를 수정하세요.", note.raw);
  if (replacement === null) return;

  updateNoteInputRange(note.sourceStart, note.sourceEnd, replacement.trim());
}

function updateNoteInputRange(start, end, replacement) {
  const source = elements.noteInput.value;
  elements.noteInput.value = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
  elements.noteInput.focus();
  elements.noteInput.setSelectionRange(start, start + replacement.length);
  render();
  setStatus(`선택한 음표를 "${replacement || "삭제"}"로 수정했습니다.`);
}

function syncSelectedNote() {
  elements.scoreCanvas.querySelectorAll(".score-note.selected").forEach((element) => {
    element.classList.remove("selected");
  });

  if (!selectedNoteId) return;
  const selected = elements.scoreCanvas.querySelector(`.score-note[data-note-id="${CSS.escape(selectedNoteId)}"]`);
  selected?.classList.add("selected");
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
