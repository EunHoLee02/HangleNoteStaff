export const NOTE_DEFS = {
  "도": { step: "C", index: 0, semitone: 0 },
  "레": { step: "D", index: 1, semitone: 2 },
  "미": { step: "E", index: 2, semitone: 4 },
  "파": { step: "F", index: 3, semitone: 5 },
  "솔": { step: "G", index: 4, semitone: 7 },
  "라": { step: "A", index: 5, semitone: 9 },
  "시": { step: "B", index: 6, semitone: 11 },
};

export const DURATION_LABELS = {
  whole: "온음표",
  half: "2분음표",
  quarter: "4분음표",
  eighth: "8분음표",
  sixteenth: "16분음표",
  thirtysixth: "36분음표",
};

const NOTE_CHARS = new Set(["도", "레", "미", "파", "솔", "라", "시", "쉼"]);
const DURATION_BY_SLASH = {
  "/1": "whole",
  "/2": "half",
  "/4": "quarter",
  "/8": "eighth",
  "/16": "sixteenth",
  "/36": "thirtysixth",
};

export function extractHangulNoteText(text) {
  const tokens = tokenize(text);
  return tokens.map((token) => token.raw).join(" ");
}

export function parseHangulNotes(text, options = {}) {
  const baseOctave = Number(options.baseOctave ?? 4);
  const defaultDuration = options.defaultDuration ?? "quarter";
  const tokens = tokenize(text);
  const notes = [];
  let measure = 1;
  let pendingBarBefore = null;

  for (const token of tokens) {
    if (token.type === "bar") {
      if (notes.length > 0) {
        notes[notes.length - 1].barAfter = token.kind;
      }
      pendingBarBefore = token.kind;
      measure += 1;
      continue;
    }

    const isRest = token.name === "쉼";
    const def = NOTE_DEFS[token.name];
    if (!isRest && !def) continue;

    const octave = isRest ? null : baseOctave + token.octaveDelta;

    const accidental = token.accidental;
    const midi = isRest ? null : 12 * (octave + 1) + def.semitone + accidental;
    notes.push({
      id: `n-${notes.length + 1}`,
      raw: token.raw,
      sourceStart: token.sourceStart,
      sourceEnd: token.sourceEnd,
      name: token.name,
      isRest,
      step: isRest ? null : def.step,
      noteIndex: isRest ? null : def.index,
      octave: isRest ? null : octave,
      accidental,
      midi,
      duration: token.duration ?? defaultDuration,
      dotted: token.dotted,
      explicitNatural: token.explicitNatural,
      articulation: token.articulation,
      ornament: token.ornament,
      grace: token.grace,
      tie: token.tie,
      slurStart: token.slurStart,
      slurEnd: token.slurEnd,
      tremolo: token.tremolo,
      fingering: token.fingering,
      marker: token.marker,
      barBefore: pendingBarBefore,
      barAfter: null,
      measure,
    });
    pendingBarBefore = null;

  }

  return notes;
}

function tokenize(text) {
  const normalized = String(text ?? "")
    .replaceAll("｜", "|")
    .replaceAll("♯", "#")
    .replaceAll("＃", "#")
    .replaceAll("♭", "b")
    .replaceAll("♮", "=")
    .replaceAll("제자리", "=")
    .replaceAll("올림", "#")
    .replaceAll("샵", "#")
    .replaceAll("내림", "b")
    .replaceAll("플랫", "b")
    .replaceAll("𝄆", "|:")
    .replaceAll("𝄇", ":|")
    .replaceAll("도돌이시작", "|:")
    .replaceAll("도돌이끝", ":|");

  const tokens = [];
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];
    const barToken = readBarToken(normalized, i);
    if (barToken) {
      tokens.push(barToken);
      i += barToken.raw.length;
      continue;
    }

    const name = NOTE_CHARS.has(char) ? char : null;
    if (!name) {
      i += 1;
      continue;
    }

    const sourceStart = i;
    let raw = name;
    let accidental = 0;
    let explicitNatural = false;
    let octaveDelta = 0;
    let duration = null;
    let dotted = false;
    let articulation = null;
    let ornament = null;
    let grace = false;
    let tie = false;
    let slurStart = false;
    let slurEnd = false;
    let tremolo = false;
    let fingering = null;
    let marker = null;
    i += 1;

    while (i < normalized.length) {
      const next = normalized[i];
      if (readBarToken(normalized, i) || NOTE_CHARS.has(next) || /\s/.test(next)) break;

      const rest = normalized.slice(i);
      const durationMatch = rest.match(/^\/(36|16|8|4|2|1)/);
      if (durationMatch) {
        duration = DURATION_BY_SLASH[`/${durationMatch[1]}`];
        raw += durationMatch[0];
        i += durationMatch[0].length;
        continue;
      }

      const fingeringMatch = rest.match(/^f([1-5])/i);
      if (fingeringMatch) {
        fingering = fingeringMatch[1];
        raw += fingeringMatch[0];
        i += fingeringMatch[0].length;
        continue;
      }

      const markerMatch = rest.match(/^(Fine|D\.C\.|D\.S\.|Coda|Segno)/i);
      if (markerMatch) {
        marker = markerMatch[1];
        raw += markerMatch[0];
        i += markerMatch[0].length;
        continue;
      }

      const ornamentMatch = rest.match(/^(tr|turn|mordent)/i);
      if (ornamentMatch) {
        ornament = ornamentMatch[1].toLowerCase();
        raw += ornamentMatch[0];
        i += ornamentMatch[0].length;
        continue;
      }

      if (next === "#") accidental = 1;
      if (next === "b") accidental = -1;
      if (next === "=") {
        accidental = 0;
        explicitNatural = true;
      }
      if (next === "'" || next === "^" || next === "↑") octaveDelta += 1;
      if (next === "," || next === "`" || next === "↓") octaveDelta -= 1;
      if (next === ".") dotted = true;
      if (next === "~") tie = true;
      if (next === "(") slurStart = true;
      if (next === ")") slurEnd = true;
      if (next === ">") articulation = "accent";
      if (next === "_") articulation = "tenuto";
      if (next === "!") articulation = "marcato";
      if (next === "g" || next === "꾸") grace = true;
      if (next === "%") tremolo = true;

      raw += next;
      i += 1;
    }

    tokens.push({
      type: "note",
      name,
      raw,
      sourceStart,
      sourceEnd: i,
      accidental,
      explicitNatural,
      octaveDelta,
      duration,
      dotted,
      articulation,
      ornament,
      grace,
      tie,
      slurStart,
      slurEnd,
      tremolo,
      fingering,
      marker,
    });
  }

  return tokens;
}

function readBarToken(text, index) {
  const rest = text.slice(index);
  if (rest.startsWith(":|:")) return { type: "bar", raw: ":|:", kind: "endStartRepeat" };
  if (rest.startsWith("|:")) return { type: "bar", raw: "|:", kind: "startRepeat" };
  if (rest.startsWith(":|")) return { type: "bar", raw: ":|", kind: "endRepeat" };
  if (rest.startsWith("||")) return { type: "bar", raw: "||", kind: "double" };
  if (rest.startsWith("|")) return { type: "bar", raw: "|", kind: "single" };
  return null;
}
