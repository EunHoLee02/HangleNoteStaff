import { NOTE_DEFS } from "./parser.js";

const STEP_TO_SOLFEGE = {
  C: "도",
  D: "레",
  E: "미",
  F: "파",
  G: "솔",
  A: "라",
  B: "시",
};

const DURATION_BY_TYPE = {
  whole: "whole",
  half: "half",
  quarter: "quarter",
  eighth: "eighth",
  "16th": "sixteenth",
  "32nd": "thirtysixth",
};

const TYPE_BY_DURATION = Object.fromEntries(
  Object.entries(DURATION_BY_TYPE).map(([type, duration]) => [duration, type]),
);

const SLASH_BY_DURATION = {
  whole: "/1",
  half: "/2",
  quarter: "/4",
  eighth: "/8",
  sixteenth: "/16",
  thirtysixth: "/36",
};

export async function readMusicXmlFile(file) {
  return readMusicXmlBlob(file, file.name);
}

export async function readMusicXmlBlob(blob, filename = "") {
  const lowerName = filename.toLowerCase();
  const arrayBuffer = await blob.arrayBuffer();
  if (lowerName.endsWith(".mxl") || blob.type.includes("zip") || isZipBuffer(arrayBuffer)) {
    const xmlText = await extractXmlFromMxl(arrayBuffer);
    return parseMusicXml(xmlText);
  }

  return parseMusicXml(new TextDecoder("utf-8").decode(arrayBuffer));
}

function isZipBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function parseMusicXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = first(doc, "parsererror");
  if (parseError) {
    throw new Error("MusicXML 파일을 읽지 못했습니다. XML 형식을 확인해주세요.");
  }

  const firstPart = Array.from(doc.getElementsByTagName("*"))
    .find((node) => node.localName === "part" && children(node, "measure").length > 0);
  if (!firstPart) {
    throw new Error("MusicXML 안에서 part 정보를 찾지 못했습니다.");
  }

  const notes = [];
  let divisions = 4;
  let timeSignature = "4/4";
  let tempo = null;

  children(firstPart, "measure").forEach((measureEl, measureIndex) => {
    const attributes = first(measureEl, "attributes");
    if (attributes) {
      divisions = Number(text(first(attributes, "divisions")) || divisions);
      const time = first(attributes, "time");
      const beats = text(first(time, "beats"));
      const beatType = text(first(time, "beat-type"));
      if (beats && beatType) timeSignature = `${beats}/${beatType}`;
    }

    const soundTempo = first(measureEl, "sound")?.getAttribute("tempo");
    if (soundTempo) tempo = Number(soundTempo);

    const measure = Number(measureEl.getAttribute("number")) || measureIndex + 1;
    const leftBarline = readMeasureBarline(measureEl, "left");
    const rightBarline = readMeasureBarline(measureEl, "right");
    const measureNotes = [];

    children(measureEl, "note").forEach((noteEl) => {
      if (first(noteEl, "chord")) return;

      const imported = readNote(noteEl, {
        divisions,
        id: `mxml-${notes.length + measureNotes.length + 1}`,
        measure,
      });

      if (imported) measureNotes.push(imported);
    });

    if (measureNotes.length > 0) {
      measureNotes[0].barBefore = leftBarline;
      measureNotes[measureNotes.length - 1].barAfter = rightBarline;
      notes.push(...measureNotes);
    }
  });

  if (notes.length === 0) {
    throw new Error("MusicXML에서 가져올 수 있는 음표를 찾지 못했습니다.");
  }

  return {
    notes,
    sourceText: toSourceText(notes),
    timeSignature,
    tempo,
  };
}

async function extractXmlFromMxl(arrayBuffer) {
  const fflate = await loadFflate();
  const files = fflate.unzipSync(new Uint8Array(arrayBuffer));
  const decoder = new TextDecoder("utf-8");
  const names = Object.keys(files);
  const container = files["META-INF/container.xml"];

  if (container) {
    const containerText = decoder.decode(container);
    const doc = new DOMParser().parseFromString(containerText, "application/xml");
    const rootfilePath = first(doc, "rootfile")?.getAttribute("full-path");
    if (rootfilePath && files[rootfilePath]) return decoder.decode(files[rootfilePath]);
  }

  const fallbackName = names.find((name) => /\.(musicxml|xml)$/i.test(name) && !name.endsWith("container.xml"));
  if (!fallbackName) {
    throw new Error("MXL 파일 안에서 MusicXML 문서를 찾지 못했습니다.");
  }

  return decoder.decode(files[fallbackName]);
}

async function loadFflate() {
  if (globalThis.fflate?.unzipSync) return globalThis.fflate;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("MXL 압축 해제 모듈을 불러오지 못했습니다."));
    document.head.append(script);
  });

  if (!globalThis.fflate?.unzipSync) {
    throw new Error("MXL 압축 해제 모듈을 사용할 수 없습니다.");
  }

  return globalThis.fflate;
}

function readNote(noteEl, context) {
  const isRest = Boolean(first(noteEl, "rest"));
  const pitch = first(noteEl, "pitch");
  const step = text(first(pitch, "step"));
  const solfege = STEP_TO_SOLFEGE[step];
  if (!isRest && !solfege) return null;

  const accidental = readAccidental(noteEl, pitch);
  const octave = isRest ? null : Number(text(first(pitch, "octave")) || 4);
  const duration = readDuration(noteEl, context.divisions);
  const name = isRest ? "쉼" : solfege;
  const def = NOTE_DEFS[name];
  const lyric = text(first(first(noteEl, "lyric"), "text"));
  const raw = lyric || toRawToken({ name, duration, accidental, octave, isRest });

  return {
    id: context.id,
    raw,
    name,
    isRest,
    step: isRest ? null : step,
    noteIndex: isRest ? null : def.index,
    octave,
    accidental,
    midi: isRest ? null : 12 * (octave + 1) + def.semitone + accidental,
    duration,
    dotted: Boolean(first(noteEl, "dot")),
    explicitNatural: readAccidentalName(noteEl) === "natural",
    articulation: readArticulation(noteEl),
    ornament: null,
    grace: Boolean(first(noteEl, "grace")),
    tie: Boolean(Array.from(noteEl.getElementsByTagName("tie")).some((tie) => tie.getAttribute("type") === "start")),
    slurStart: false,
    slurEnd: false,
    tremolo: false,
    fingering: null,
    marker: null,
    barBefore: null,
    barAfter: null,
    measure: context.measure,
  };
}

function readDuration(noteEl, divisions) {
  const type = text(first(noteEl, "type"));
  if (DURATION_BY_TYPE[type]) return DURATION_BY_TYPE[type];

  const units = Number(text(first(noteEl, "duration")));
  if (!units || !divisions) return "quarter";

  const ratio = units / divisions;
  if (ratio >= 4) return "whole";
  if (ratio >= 2) return "half";
  if (ratio >= 1) return "quarter";
  if (ratio >= 0.5) return "eighth";
  return "sixteenth";
}

function readAccidental(noteEl, pitch) {
  const alter = Number(text(first(pitch, "alter")) || 0);
  if (alter) return Math.max(-1, Math.min(1, alter));

  const accidental = readAccidentalName(noteEl);
  if (accidental === "sharp") return 1;
  if (accidental === "flat") return -1;
  return 0;
}

function readAccidentalName(noteEl) {
  return text(first(noteEl, "accidental")).toLowerCase();
}

function readArticulation(noteEl) {
  const articulations = first(noteEl, "articulations");
  if (!articulations) return null;
  if (first(articulations, "accent")) return "accent";
  if (first(articulations, "tenuto")) return "tenuto";
  if (first(articulations, "strong-accent")) return "marcato";
  return null;
}

function readMeasureBarline(measureEl, location) {
  const barline = children(measureEl, "barline").find((item) => item.getAttribute("location") === location);
  if (!barline) return null;

  const repeat = first(barline, "repeat")?.getAttribute("direction");
  if (repeat === "forward") return "startRepeat";
  if (repeat === "backward") return "endRepeat";

  const style = text(first(barline, "bar-style"));
  if (style === "light-light") return "double";
  return null;
}

function toSourceText(notes) {
  const measures = new Map();
  notes.forEach((note) => {
    if (!measures.has(note.measure)) measures.set(note.measure, []);
    measures.get(note.measure).push(toRawToken(note));
  });

  return Array.from(measures.values())
    .map((items) => items.join(" "))
    .join(" | ");
}

function toRawToken(note) {
  const accidental = note.accidental === 1 ? "#" : note.accidental === -1 ? "b" : "";
  const duration = note.duration && note.duration !== "quarter" ? SLASH_BY_DURATION[note.duration] ?? "" : "";
  const dot = note.dotted ? "." : "";
  return `${note.name}${accidental}${duration}${dot}`;
}

function first(root, tagName) {
  if (!root) return null;
  return Array.from(root.getElementsByTagName("*")).find((node) => node.localName === tagName) ?? null;
}

function children(root, tagName) {
  if (!root) return [];
  return Array.from(root.children).filter((node) => node.localName === tagName);
}

function text(node) {
  return node?.textContent?.trim() ?? "";
}
