const DURATION_DIVISIONS = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  sixteenth: 1,
};

const TYPE_BY_DURATION = {
  whole: "whole",
  half: "half",
  quarter: "quarter",
  eighth: "eighth",
  sixteenth: "16th",
};

export function buildMusicXml(notes, options = {}) {
  const title = options.title ?? "Hangul Note Staff Score";
  const tempo = Number(options.tempo ?? 96);
  const [beats, beatType] = String(options.timeSignature ?? "4/4").split("/");
  const measures = groupByMeasure(notes);

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${escapeXml(title)}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Hangul melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measures
  .map((measureNotes, index) => renderMeasure(measureNotes, index + 1, { beats, beatType, tempo, includeAttributes: index === 0 }))
  .join("\n")}
  </part>
</score-partwise>
`;
}

function groupByMeasure(notes) {
  if (notes.length === 0) return [[]];
  const result = [];
  notes.forEach((note) => {
    const index = Math.max(0, note.measure - 1);
    if (!result[index]) result[index] = [];
    result[index].push(note);
  });
  return result.filter(Boolean);
}

function renderMeasure(notes, number, context) {
  const attributes = context.includeAttributes
    ? `    <attributes>
      <divisions>4</divisions>
      <key>
        <fifths>0</fifths>
      </key>
      <time>
        <beats>${context.beats}</beats>
        <beat-type>${context.beatType}</beat-type>
      </time>
      <clef>
        <sign>G</sign>
        <line>2</line>
      </clef>
    </attributes>
    <direction placement="above">
      <direction-type>
        <metronome>
          <beat-unit>quarter</beat-unit>
          <per-minute>${context.tempo}</per-minute>
        </metronome>
      </direction-type>
      <sound tempo="${context.tempo}"/>
    </direction>`
    : "";

  return `  <measure number="${number}">
${attributes}
${notes.map(renderNote).join("\n")}
  </measure>`;
}

function renderNote(note) {
  const duration = DURATION_DIVISIONS[note.duration] ?? DURATION_DIVISIONS.quarter;
  const type = TYPE_BY_DURATION[note.duration] ?? TYPE_BY_DURATION.quarter;
  const restOrPitch = note.isRest
    ? "    <rest/>"
    : `    <pitch>
      <step>${note.step}</step>
${note.accidental ? `      <alter>${note.accidental}</alter>\n` : ""}      <octave>${note.octave}</octave>
    </pitch>`;

  return `    <note>
${restOrPitch}
    <duration>${duration}</duration>
    <type>${type}</type>
${note.accidental ? `    <accidental>${note.accidental === 1 ? "sharp" : "flat"}</accidental>\n` : ""}    <lyric>
      <syllabic>single</syllabic>
      <text>${escapeXml(note.raw)}</text>
    </lyric>
  </note>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
