const LINE_GAP = 12;
const STEP_GAP = LINE_GAP / 2;
const STAFF_TOP = 92;
const STAFF_LEFT = 78;
const NOTE_GAP = 58;
const NOTE_HEAD_RX = 9;
const NOTE_HEAD_RY = 6;
const BOTTOM_LINE_STEP = 4 * 7 + 2; // E4 on treble clef.

export function renderStaffSvg(notes, options = {}) {
  const timeSignature = options.timeSignature ?? "4/4";
  const tempo = Number(options.tempo ?? 96);
  const width = Math.max(760, STAFF_LEFT + 90 + notes.length * NOTE_GAP);
  const height = 260;
  const staffRight = width - 36;
  const parts = [
    `<svg id="scoreSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="한글 음계 오선보">`,
    `<rect width="${width}" height="${height}" fill="#fffefa"/>`,
    `<text x="28" y="34" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="16" font-weight="700" fill="#1d2528">Hangul Note Staff</text>`,
    `<text x="${width - 150}" y="34" font-family="Segoe UI, sans-serif" font-size="13" fill="#697579">Tempo ${tempo}</text>`,
    renderStaffLines(staffRight),
    renderClefAndMeter(timeSignature),
  ];

  let lastMeasure = 1;
  notes.forEach((note, index) => {
    const x = STAFF_LEFT + 98 + index * NOTE_GAP;
    if (note.measure !== lastMeasure) {
      parts.push(renderBarLine(x - NOTE_GAP / 2));
      lastMeasure = note.measure;
    }
    parts.push(note.isRest ? renderRest(note, x) : renderNote(note, x));
  });

  parts.push(renderBarLine(staffRight));
  parts.push("</svg>");
  return parts.join("");
}

function renderStaffLines(staffRight) {
  return Array.from({ length: 5 }, (_, index) => {
    const y = STAFF_TOP + index * LINE_GAP;
    return `<line x1="${STAFF_LEFT}" y1="${y}" x2="${staffRight}" y2="${y}" stroke="#1d2528" stroke-width="1.4"/>`;
  }).join("");
}

function renderClefAndMeter(timeSignature) {
  const [top, bottom] = timeSignature.split("/");
  return [
    `<text x="${STAFF_LEFT + 6}" y="${STAFF_TOP + 48}" font-family="Georgia, serif" font-size="58" fill="#1d2528">𝄞</text>`,
    `<text x="${STAFF_LEFT + 58}" y="${STAFF_TOP + 19}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#1d2528">${top}</text>`,
    `<text x="${STAFF_LEFT + 58}" y="${STAFF_TOP + 43}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#1d2528">${bottom}</text>`,
  ].join("");
}

function renderNote(note, x) {
  const y = pitchY(note);
  const isOpen = note.duration === "whole" || note.duration === "half";
  const needsStem = note.duration !== "whole";
  const stemUp = y >= STAFF_TOP + LINE_GAP * 2;
  const stemX = stemUp ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
  const stemY2 = stemUp ? y - 42 : y + 42;
  const labelY = STAFF_TOP + 98;
  const accidental = note.accidental === 1 ? "#" : note.accidental === -1 ? "b" : "";

  return [
    renderLedgerLines(y, x),
    accidental ? `<text x="${x - 27}" y="${y + 5}" font-family="Georgia, serif" font-size="20" fill="#1d2528">${accidental}</text>` : "",
    `<ellipse cx="${x}" cy="${y}" rx="${NOTE_HEAD_RX}" ry="${NOTE_HEAD_RY}" transform="rotate(-18 ${x} ${y})" fill="${isOpen ? "#fffefa" : "#1d2528"}" stroke="#1d2528" stroke-width="1.8"/>`,
    needsStem ? `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemY2}" stroke="#1d2528" stroke-width="1.7"/>` : "",
    note.duration === "eighth" || note.duration === "sixteenth" ? renderFlag(stemX, stemY2, stemUp) : "",
    `<text x="${x}" y="${labelY}" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="13" fill="#25735a">${escapeXml(note.raw)}</text>`,
  ].join("");
}

function renderRest(note, x) {
  const y = STAFF_TOP + LINE_GAP * 2;
  const shape =
    note.duration === "whole"
      ? `<rect x="${x - 10}" y="${y - 12}" width="20" height="6" fill="#1d2528"/>`
      : note.duration === "half"
        ? `<rect x="${x - 10}" y="${y}" width="20" height="6" fill="#1d2528"/>`
        : `<path d="M ${x - 4} ${y - 20} C ${x + 14} ${y - 9}, ${x - 14} ${y + 2}, ${x + 3} ${y + 18}" fill="none" stroke="#1d2528" stroke-width="3" stroke-linecap="round"/>`;
  return [
    shape,
    `<text x="${x}" y="${STAFF_TOP + 98}" text-anchor="middle" font-family="Segoe UI, Malgun Gothic, sans-serif" font-size="13" fill="#25735a">${escapeXml(note.raw)}</text>`,
  ].join("");
}

function pitchY(note) {
  const diatonicStep = note.octave * 7 + note.noteIndex;
  return STAFF_TOP + 4 * LINE_GAP - (diatonicStep - BOTTOM_LINE_STEP) * STEP_GAP;
}

function renderLedgerLines(y, x) {
  const topLine = STAFF_TOP;
  const bottomLine = STAFF_TOP + 4 * LINE_GAP;
  const lines = [];

  for (let lineY = bottomLine + LINE_GAP; lineY <= y + 1; lineY += LINE_GAP) {
    lines.push(`<line x1="${x - 15}" y1="${lineY}" x2="${x + 15}" y2="${lineY}" stroke="#1d2528" stroke-width="1.2"/>`);
  }

  for (let lineY = topLine - LINE_GAP; lineY >= y - 1; lineY -= LINE_GAP) {
    lines.push(`<line x1="${x - 15}" y1="${lineY}" x2="${x + 15}" y2="${lineY}" stroke="#1d2528" stroke-width="1.2"/>`);
  }

  return lines.join("");
}

function renderFlag(stemX, stemY, stemUp) {
  const control = stemUp
    ? `M ${stemX} ${stemY} C ${stemX + 22} ${stemY + 8}, ${stemX + 18} ${stemY + 24}, ${stemX + 6} ${stemY + 30}`
    : `M ${stemX} ${stemY} C ${stemX + 22} ${stemY - 8}, ${stemX + 18} ${stemY - 24}, ${stemX + 6} ${stemY - 30}`;
  return `<path d="${control}" fill="none" stroke="#1d2528" stroke-width="1.8"/>`;
}

function renderBarLine(x) {
  return `<line x1="${x}" y1="${STAFF_TOP}" x2="${x}" y2="${STAFF_TOP + 4 * LINE_GAP}" stroke="#1d2528" stroke-width="1.4"/>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
