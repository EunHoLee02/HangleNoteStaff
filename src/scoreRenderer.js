const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_MARGIN = 58;
const LINE_GAP = 12;
const STEP_GAP = LINE_GAP / 2;
const STAFF_LEFT = 76;
const STAFF_RIGHT = PAGE_WIDTH - PAGE_MARGIN;
const NOTE_HEAD_RX = 8.8;
const NOTE_HEAD_RY = 5.8;
const BOTTOM_LINE_STEP = 4 * 7 + 2; // E4 on treble clef.
const FIRST_SYSTEM_TOP = 104;
const SYSTEM_GAP = 116;
const SYSTEMS_PER_PAGE = 8;
const MEASURES_PER_SYSTEM = 4;
const NOTES_PER_PAGE = SYSTEMS_PER_PAGE * MEASURES_PER_SYSTEM * 8;

export const A4_PAGE = {
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  notesPerPage: NOTES_PER_PAGE,
  measuresPerSystem: MEASURES_PER_SYSTEM,
};

export function renderPagedScore(notes, options = {}) {
  const systems = chunkNotesByMeasure(notes, MEASURES_PER_SYSTEM);
  const pages = chunkItems(systems, SYSTEMS_PER_PAGE);
  const pageSvgs = pages.map((pageSystems, index) =>
    renderScorePage(pageSystems, {
      ...options,
      pageIndex: index + 1,
      pageCount: pages.length,
    }),
  );

  return {
    notesPerPage: NOTES_PER_PAGE,
    pageCount: pageSvgs.length,
    pages: pageSvgs,
    html: pageSvgs
      .map(
        (svg, index) => `<div class="score-page">${svg}<div class="page-caption">${index + 1} / ${pageSvgs.length}</div></div>`,
      )
      .join(""),
  };
}

export function renderEmptyPage() {
  return `<svg id="scoreSvgPage1" class="score-page-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" role="img" aria-label="빈 악보" data-page="1">
    <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#fffefa"/>
    <text x="${PAGE_WIDTH / 2}" y="${PAGE_HEIGHT / 2}" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="18" fill="#697579">한글 음계를 입력하면 A4 악보가 표시됩니다.</text>
  </svg>`;
}

function chunkNotes(notes, size) {
  if (notes.length === 0) return [[]];
  const result = [];
  for (let index = 0; index < notes.length; index += size) {
    result.push(notes.slice(index, index + size));
  }
  return result;
}

function chunkItems(items, size) {
  if (items.length === 0) return [[]];
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function chunkNotesByMeasure(notes, maxMeasures) {
  if (notes.length === 0) return [[]];

  const result = [];
  let current = [];
  let currentMeasures = new Set();

  notes.forEach((note) => {
    const nextMeasures = new Set(currentMeasures);
    nextMeasures.add(note.measure);
    if (current.length > 0 && nextMeasures.size > maxMeasures) {
      result.push(current);
      current = [];
      currentMeasures = new Set();
    }

    current.push(note);
    currentMeasures.add(note.measure);
  });

  if (current.length > 0) result.push(current);
  return result;
}

function renderScorePage(systems, options = {}) {
  const timeSignature = options.timeSignature ?? "4/4";
  const tempo = Number(options.tempo ?? 96);
  const pageIndex = Number(options.pageIndex ?? 1);
  const pageCount = Number(options.pageCount ?? 1);
  const parts = [
    `<svg id="scoreSvgPage${pageIndex}" class="score-page-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" role="img" aria-label="한글 음계 A4 악보 ${pageIndex}쪽" data-page="${pageIndex}">`,
    `<rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#fffefa"/>`,
    `<text x="${PAGE_WIDTH - PAGE_MARGIN}" y="44" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="12" fill="#697579">Tempo ${tempo}</text>`,
    `<text x="${PAGE_WIDTH - PAGE_MARGIN}" y="${PAGE_HEIGHT - 34}" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="12" fill="#697579">${pageIndex} / ${pageCount}</text>`,
  ];

  systems.forEach((systemNotes, systemIndex) => {
    const staffTop = FIRST_SYSTEM_TOP + systemIndex * SYSTEM_GAP;
    parts.push(renderSystem(systemNotes, staffTop, {
      showClefAndMeter: true,
      timeSignature,
    }));
  });

  parts.push("</svg>");
  return parts.join("");
}

function renderSystem(notes, staffTop, options) {
  const noteAreaLeft = STAFF_LEFT + 94;
  const noteAreaRight = STAFF_RIGHT - 18;
  const noteGap = (noteAreaRight - noteAreaLeft) / Math.max(1, notes.length - 1);
  const notePositions = new Map();
  const parts = [
    renderStaffLines(staffTop),
    options.showClefAndMeter ? renderClefAndMeter(staffTop, options.timeSignature) : "",
  ];

  let lastMeasure = notes[0]?.measure ?? null;
  notes.forEach((note, index) => {
    const x = noteAreaLeft + index * noteGap;
    notePositions.set(note.id, { x, y: note.isRest ? staffTop + LINE_GAP * 2 : pitchY(note, staffTop) });

    if (index === 0 && note.barBefore && note.barBefore !== "single") {
      parts.push(renderBarLine(x - Math.min(noteGap * 0.55, 28), staffTop, note.barBefore));
    }

    if (lastMeasure !== null && note.measure !== lastMeasure) {
      parts.push(renderBarLine(x - noteGap / 2, staffTop, note.barBefore ?? "single"));
      lastMeasure = note.measure;
    }
    parts.push(note.isRest ? renderRest(note, x, staffTop) : renderNote(note, x, staffTop));
  });

  parts.push(renderConnectors(notes, notePositions, staffTop));
  parts.push(renderBarLine(STAFF_RIGHT, staffTop, notes.at(-1)?.barAfter ?? "single"));
  return parts.join("");
}

function renderStaffLines(staffTop) {
  return Array.from({ length: 5 }, (_, index) => {
    const y = staffTop + index * LINE_GAP;
    return `<line x1="${STAFF_LEFT}" y1="${y}" x2="${STAFF_RIGHT}" y2="${y}" stroke="#1d2528" stroke-width="1.35"/>`;
  }).join("");
}

function renderClefAndMeter(staffTop, timeSignature) {
  const [top, bottom] = timeSignature.split("/");
  const meterX = STAFF_LEFT + 40;
  return [
    `<text x="${STAFF_LEFT + 5}" y="${staffTop + 48}" font-family="Georgia, serif" font-size="56" fill="#1d2528">𝄞</text>`,
    `<text x="${meterX}" y="${staffTop + 19}" font-family="Georgia, serif" font-size="21" font-weight="700" fill="#1d2528">${top}</text>`,
    `<text x="${meterX}" y="${staffTop + 43}" font-family="Georgia, serif" font-size="21" font-weight="700" fill="#1d2528">${bottom}</text>`,
  ].join("");
}

function renderNote(note, x, staffTop) {
  const y = pitchY(note, staffTop);
  const isOpen = note.duration === "whole" || note.duration === "half";
  const needsStem = note.duration !== "whole";
  const stemUp = y >= staffTop + LINE_GAP * 2;
  const stemX = stemUp ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
  const stemY2 = stemUp ? y - 40 : y + 40;
  const labelY = staffTop + 82;
  const accidental = note.accidental === 1 ? "#" : note.accidental === -1 ? "b" : note.explicitNatural ? "♮" : "";
  const flagCount = getFlagCount(note.duration);
  const scale = note.grace ? 0.72 : 1;
  const rx = NOTE_HEAD_RX * scale;
  const ry = NOTE_HEAD_RY * scale;
  const stemLength = note.grace ? 31 : 40;
  const graceStemY2 = stemUp ? y - stemLength : y + stemLength;

  return [
    renderLedgerLines(y, x, staffTop),
    accidental ? `<text x="${x - 25}" y="${y + 5}" font-family="Georgia, serif" font-size="19" fill="#1d2528">${accidental}</text>` : "",
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(-18 ${x} ${y})" fill="${isOpen ? "#fffefa" : "#1d2528"}" stroke="#1d2528" stroke-width="${note.grace ? 1.35 : 1.7}"/>`,
    needsStem ? `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${graceStemY2}" stroke="#1d2528" stroke-width="${note.grace ? 1.25 : 1.6}"/>` : "",
    note.grace ? `<line x1="${stemX - 8}" y1="${y - 10}" x2="${stemX + 8}" y2="${y + 8}" stroke="#1d2528" stroke-width="1.3"/>` : "",
    flagCount > 0 ? renderFlags(stemX, graceStemY2, stemUp, flagCount) : "",
    note.dotted ? `<circle cx="${x + 17}" cy="${y - 1}" r="2.2" fill="#1d2528"/>` : "",
    renderArticulation(note, x, y, staffTop),
    renderOrnament(note, x, staffTop),
    note.tremolo ? renderTremolo(stemX, y, stemUp) : "",
    note.fingering ? `<text x="${x}" y="${staffTop - 14}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#1d2528">${escapeXml(note.fingering)}</text>` : "",
    note.marker ? `<text x="${x}" y="${staffTop - 27}" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="700" fill="#1d2528">${escapeXml(note.marker)}</text>` : "",
    `<text x="${x}" y="${labelY}" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="12" fill="#25735a">${escapeXml(note.raw)}</text>`,
  ].join("");
}

function renderRest(note, x, staffTop) {
  const y = staffTop + LINE_GAP * 2;
  const shape =
    note.duration === "whole"
      ? `<rect x="${x - 10}" y="${y - 12}" width="20" height="6" fill="#1d2528"/>`
      : note.duration === "half"
        ? `<rect x="${x - 10}" y="${y}" width="20" height="6" fill="#1d2528"/>`
        : `<path d="M ${x - 4} ${y - 20} C ${x + 14} ${y - 9}, ${x - 14} ${y + 2}, ${x + 3} ${y + 18}" fill="none" stroke="#1d2528" stroke-width="3" stroke-linecap="round"/>`;
  return [
    shape,
    note.dotted ? `<circle cx="${x + 17}" cy="${y - 2}" r="2.2" fill="#1d2528"/>` : "",
    `<text x="${x}" y="${staffTop + 82}" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="12" fill="#25735a">${escapeXml(note.raw)}</text>`,
  ].join("");
}

function pitchY(note, staffTop) {
  const diatonicStep = note.octave * 7 + note.noteIndex;
  return staffTop + 4 * LINE_GAP - (diatonicStep - BOTTOM_LINE_STEP) * STEP_GAP;
}

function renderLedgerLines(y, x, staffTop) {
  const topLine = staffTop;
  const bottomLine = staffTop + 4 * LINE_GAP;
  const lines = [];

  for (let lineY = bottomLine + LINE_GAP; lineY <= y + 1; lineY += LINE_GAP) {
    lines.push(`<line x1="${x - 15}" y1="${lineY}" x2="${x + 15}" y2="${lineY}" stroke="#1d2528" stroke-width="1.15"/>`);
  }

  for (let lineY = topLine - LINE_GAP; lineY >= y - 1; lineY -= LINE_GAP) {
    lines.push(`<line x1="${x - 15}" y1="${lineY}" x2="${x + 15}" y2="${lineY}" stroke="#1d2528" stroke-width="1.15"/>`);
  }

  return lines.join("");
}

function getFlagCount(duration) {
  if (duration === "eighth") return 1;
  if (duration === "sixteenth") return 2;
  if (duration === "thirtysixth") return 3;
  return 0;
}

function renderFlags(stemX, stemY, stemUp, count) {
  return Array.from({ length: count }, (_, index) => {
    const offset = stemUp ? index * 7 : -index * 7;
    return renderFlag(stemX, stemY + offset, stemUp);
  }).join("");
}

function renderFlag(stemX, stemY, stemUp) {
  const control = stemUp
    ? `M ${stemX} ${stemY} C ${stemX + 21} ${stemY + 8}, ${stemX + 17} ${stemY + 23}, ${stemX + 6} ${stemY + 29}`
    : `M ${stemX} ${stemY} C ${stemX + 21} ${stemY - 8}, ${stemX + 17} ${stemY - 23}, ${stemX + 6} ${stemY - 29}`;
  return `<path d="${control}" fill="none" stroke="#1d2528" stroke-width="1.7"/>`;
}

function renderBarLine(x, staffTop, kind = "single") {
  const y1 = staffTop;
  const y2 = staffTop + 4 * LINE_GAP;
  const dotY1 = staffTop + LINE_GAP * 1.5;
  const dotY2 = staffTop + LINE_GAP * 2.5;

  if (kind === "double") {
    return [
      `<line x1="${x - 3}" y1="${y1}" x2="${x - 3}" y2="${y2}" stroke="#1d2528" stroke-width="1.15"/>`,
      `<line x1="${x + 3}" y1="${y1}" x2="${x + 3}" y2="${y2}" stroke="#1d2528" stroke-width="1.15"/>`,
    ].join("");
  }

  if (kind === "startRepeat") {
    return [
      `<line x1="${x - 4}" y1="${y1}" x2="${x - 4}" y2="${y2}" stroke="#1d2528" stroke-width="1.15"/>`,
      `<line x1="${x + 2}" y1="${y1}" x2="${x + 2}" y2="${y2}" stroke="#1d2528" stroke-width="3.4"/>`,
      `<circle cx="${x + 10}" cy="${dotY1}" r="2.2" fill="#1d2528"/>`,
      `<circle cx="${x + 10}" cy="${dotY2}" r="2.2" fill="#1d2528"/>`,
    ].join("");
  }

  if (kind === "endRepeat") {
    return [
      `<circle cx="${x - 10}" cy="${dotY1}" r="2.2" fill="#1d2528"/>`,
      `<circle cx="${x - 10}" cy="${dotY2}" r="2.2" fill="#1d2528"/>`,
      `<line x1="${x - 2}" y1="${y1}" x2="${x - 2}" y2="${y2}" stroke="#1d2528" stroke-width="3.4"/>`,
      `<line x1="${x + 4}" y1="${y1}" x2="${x + 4}" y2="${y2}" stroke="#1d2528" stroke-width="1.15"/>`,
    ].join("");
  }

  if (kind === "endStartRepeat") {
    return `${renderBarLine(x - 4, staffTop, "endRepeat")}${renderBarLine(x + 10, staffTop, "startRepeat")}`;
  }

  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#1d2528" stroke-width="1.35"/>`;
}

function renderArticulation(note, x, y, staffTop) {
  const symbolY = y < staffTop + LINE_GAP * 2 ? y + 24 : y - 17;
  if (note.articulation === "accent") {
    return `<text x="${x}" y="${symbolY}" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#1d2528">&gt;</text>`;
  }
  if (note.articulation === "tenuto") {
    return `<line x1="${x - 7}" y1="${symbolY - 4}" x2="${x + 7}" y2="${symbolY - 4}" stroke="#1d2528" stroke-width="1.6"/>`;
  }
  if (note.articulation === "marcato") {
    return `<text x="${x}" y="${symbolY}" text-anchor="middle" font-family="Georgia, serif" font-size="19" fill="#1d2528">^</text>`;
  }
  return "";
}

function renderOrnament(note, x, staffTop) {
  if (!note.ornament) return "";
  const label = note.ornament === "tr" ? "tr" : note.ornament === "turn" ? "𝆗" : "𝆝";
  return `<text x="${x}" y="${staffTop - 18}" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#1d2528">${label}</text>`;
}

function renderTremolo(stemX, y, stemUp) {
  const baseY = stemUp ? y - 20 : y + 16;
  return Array.from({ length: 3 }, (_, index) => {
    const yy = baseY + index * (stemUp ? 6 : -6);
    return `<line x1="${stemX - 7}" y1="${yy + 5}" x2="${stemX + 8}" y2="${yy - 1}" stroke="#1d2528" stroke-width="2"/>`;
  }).join("");
}

function renderConnectors(notes, notePositions, staffTop) {
  const parts = [];
  notes.forEach((note, index) => {
    if (!note.tie && !note.slurStart) return;
    const start = notePositions.get(note.id);
    const endNote = note.slurStart
      ? notes.slice(index + 1).find((candidate) => candidate.slurEnd && !candidate.isRest) ?? notes[index + 1]
      : notes[index + 1];
    if (!start || !endNote || endNote.isRest) return;
    const end = notePositions.get(endNote.id);
    if (!end) return;
    const y = Math.max(start.y, end.y) + 18;
    const controlY = y + (note.tie ? 12 : 18);
    parts.push(`<path d="M ${start.x + 10} ${y} Q ${(start.x + end.x) / 2} ${controlY} ${end.x - 10} ${y}" fill="none" stroke="#1d2528" stroke-width="${note.tie ? 1.45 : 1.65}"/>`);
  });
  return parts.join("");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
