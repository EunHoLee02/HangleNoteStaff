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
const NOTES_PER_SYSTEM = 12;
const NOTES_PER_PAGE = SYSTEMS_PER_PAGE * NOTES_PER_SYSTEM;

export const A4_PAGE = {
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  notesPerPage: NOTES_PER_PAGE,
};

export function renderPagedScore(notes, options = {}) {
  const pages = chunkNotes(notes, NOTES_PER_PAGE);
  const pageSvgs = pages.map((pageNotes, index) =>
    renderScorePage(pageNotes, {
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

function renderScorePage(notes, options = {}) {
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

  const systems = chunkNotes(notes, NOTES_PER_SYSTEM);
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
  const noteGap = (noteAreaRight - noteAreaLeft) / Math.max(1, NOTES_PER_SYSTEM - 1);
  const parts = [
    renderStaffLines(staffTop),
    options.showClefAndMeter ? renderClefAndMeter(staffTop, options.timeSignature) : "",
  ];

  let lastMeasure = notes[0]?.measure ?? null;
  notes.forEach((note, index) => {
    const x = noteAreaLeft + index * noteGap;
    if (lastMeasure !== null && note.measure !== lastMeasure) {
      parts.push(renderBarLine(x - noteGap / 2, staffTop));
      lastMeasure = note.measure;
    }
    parts.push(note.isRest ? renderRest(note, x, staffTop) : renderNote(note, x, staffTop));
  });

  parts.push(renderBarLine(STAFF_RIGHT, staffTop));
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
  return [
    `<text x="${STAFF_LEFT + 5}" y="${staffTop + 48}" font-family="Georgia, serif" font-size="56" fill="#1d2528">𝄞</text>`,
    `<text x="${STAFF_LEFT + 57}" y="${staffTop + 19}" font-family="Georgia, serif" font-size="21" font-weight="700" fill="#1d2528">${top}</text>`,
    `<text x="${STAFF_LEFT + 57}" y="${staffTop + 43}" font-family="Georgia, serif" font-size="21" font-weight="700" fill="#1d2528">${bottom}</text>`,
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
  const accidental = note.accidental === 1 ? "#" : note.accidental === -1 ? "b" : "";

  return [
    renderLedgerLines(y, x, staffTop),
    accidental ? `<text x="${x - 25}" y="${y + 5}" font-family="Georgia, serif" font-size="19" fill="#1d2528">${accidental}</text>` : "",
    `<ellipse cx="${x}" cy="${y}" rx="${NOTE_HEAD_RX}" ry="${NOTE_HEAD_RY}" transform="rotate(-18 ${x} ${y})" fill="${isOpen ? "#fffefa" : "#1d2528"}" stroke="#1d2528" stroke-width="1.7"/>`,
    needsStem ? `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemY2}" stroke="#1d2528" stroke-width="1.6"/>` : "",
    note.duration === "eighth" || note.duration === "sixteenth" ? renderFlag(stemX, stemY2, stemUp) : "",
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

function renderFlag(stemX, stemY, stemUp) {
  const control = stemUp
    ? `M ${stemX} ${stemY} C ${stemX + 21} ${stemY + 8}, ${stemX + 17} ${stemY + 23}, ${stemX + 6} ${stemY + 29}`
    : `M ${stemX} ${stemY} C ${stemX + 21} ${stemY - 8}, ${stemX + 17} ${stemY - 23}, ${stemX + 6} ${stemY - 29}`;
  return `<path d="${control}" fill="none" stroke="#1d2528" stroke-width="1.7"/>`;
}

function renderBarLine(x, staffTop) {
  return `<line x1="${x}" y1="${staffTop}" x2="${x}" y2="${staffTop + 4 * LINE_GAP}" stroke="#1d2528" stroke-width="1.35"/>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
