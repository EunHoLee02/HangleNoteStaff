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
};

const NOTE_CHARS = new Set(["도", "레", "미", "파", "솔", "라", "시", "쉼"]);
const DURATION_BY_SLASH = {
  "/1": "whole",
  "/2": "half",
  "/4": "quarter",
  "/8": "eighth",
  "/16": "sixteenth",
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
  let currentOctave = baseOctave;
  let previousIndex = null;
  let measure = 1;

  for (const token of tokens) {
    if (token.type === "bar") {
      measure += 1;
      previousIndex = null;
      continue;
    }

    const isRest = token.name === "쉼";
    const def = NOTE_DEFS[token.name];
    if (!isRest && !def) continue;

    let octave = currentOctave;
    if (!isRest && token.octaveDelta === 0 && previousIndex !== null) {
      if (previousIndex === 6 && def.index === 0) currentOctave += 1;
      if (previousIndex === 0 && def.index === 6 && currentOctave > 1) currentOctave -= 1;
      octave = currentOctave;
    }

    if (!isRest && token.octaveDelta !== 0) {
      octave = baseOctave + token.octaveDelta;
      currentOctave = octave;
    }

    const accidental = token.accidental;
    const midi = isRest ? null : 12 * (octave + 1) + def.semitone + accidental;
    notes.push({
      id: `n-${notes.length + 1}`,
      raw: token.raw,
      name: token.name,
      isRest,
      step: isRest ? null : def.step,
      noteIndex: isRest ? null : def.index,
      octave: isRest ? null : octave,
      accidental,
      midi,
      duration: token.duration ?? defaultDuration,
      measure,
    });

    if (!isRest) previousIndex = def.index;
  }

  return notes;
}

function tokenize(text) {
  const normalized = String(text ?? "")
    .replaceAll("｜", "|")
    .replaceAll("♯", "#")
    .replaceAll("＃", "#")
    .replaceAll("♭", "b")
    .replaceAll("♮", "")
    .replaceAll("올림", "#")
    .replaceAll("샵", "#")
    .replaceAll("내림", "b")
    .replaceAll("플랫", "b");

  const tokens = [];
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];
    if (char === "|") {
      tokens.push({ type: "bar", raw: "|" });
      i += 1;
      continue;
    }

    const name = NOTE_CHARS.has(char) ? char : null;
    if (!name) {
      i += 1;
      continue;
    }

    let raw = name;
    let accidental = 0;
    let octaveDelta = 0;
    let duration = null;
    i += 1;

    while (i < normalized.length) {
      const next = normalized[i];
      if (next === "|" || NOTE_CHARS.has(next) || /\s/.test(next)) break;

      raw += next;
      if (next === "#") accidental = 1;
      if (next === "b") accidental = -1;
      if (next === "'" || next === "^" || next === "↑") octaveDelta += 1;
      if (next === "," || next === "`" || next === "↓") octaveDelta -= 1;

      const rest = normalized.slice(i);
      const durationMatch = rest.match(/^\/(16|8|4|2|1)/);
      if (durationMatch) {
        duration = DURATION_BY_SLASH[`/${durationMatch[1]}`];
        raw = raw.slice(0, -1) + durationMatch[0];
        i += durationMatch[0].length;
        continue;
      }

      i += 1;
    }

    tokens.push({ type: "note", name, raw, accidental, octaveDelta, duration });
  }

  return tokens;
}
