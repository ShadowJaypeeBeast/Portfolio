// Best-effort resume parser. Real resumes come in wildly different
// formats, so this is deliberately conservative: it looks for common
// section headers and patterns, and returns a "draft" the admin panel
// asks the person to review before it touches the live site.

const SECTION_HEADERS = {
  summary: /^(summary|profile|about( me)?|objective)\b/i,
  skills: /^(skills|technical skills|core competencies|technologies)\b/i,
  experience: /^(experience|work experience|employment history|professional experience)\b/i,
};

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*';
const DATE_RANGE_RE = new RegExp(
  `(${MONTH}\\d{4}|\\d{4})\\s*(?:[-\u2013\u2014]|to)\\s*(${MONTH}\\d{4}|\\d{4}|present|current)`,
  'i'
);

function splitSections(lines) {
  const sections = { summary: [], skills: [], experience: [], other: [] };
  let current = 'other';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let matched = null;
    if (line.length < 40) {
      for (const [key, re] of Object.entries(SECTION_HEADERS)) {
        if (re.test(line)) { matched = key; break; }
      }
    }
    if (matched) { current = matched; continue; }
    sections[current].push(line);
  }
  return sections;
}

function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : '';
}

function extractSkills(lines) {
  if (!lines.length) return [];
  return lines
    .join(', ')
    .split(/[,•|/\n]/)
    .map((s) => s.replace(/^[-–\s]+/, '').trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 20);
}

function extractParagraphs(lines) {
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const paragraphs = [];
  let current = '';
  for (const s of sentences) {
    if (current && (current + ' ' + s).length > 320) {
      paragraphs.push(current.trim());
      current = s;
    } else {
      current = current ? current + ' ' + s : s;
    }
  }
  if (current) paragraphs.push(current.trim());
  return paragraphs.slice(0, 4);
}

function extractExperience(lines) {
  const entries = [];
  let currentEntry = null;
  let lastNonDateLine = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const dateMatch = line.match(DATE_RANGE_RE);

    if (dateMatch) {
      if (currentEntry) entries.push(currentEntry);
      let heading = line.replace(dateMatch[0], '').replace(/[|,\-–—]+$/, '').trim();
      if (!heading) heading = lastNonDateLine;
      let role = heading;
      let org = '';
      const sep = heading.match(/^(.*?)\s*(?:@|,| at | - | – )\s*(.+)$/);
      if (sep && sep[1] && sep[2]) {
        role = sep[1].trim();
        org = sep[2].trim();
      }
      currentEntry = { role, org, period: dateMatch[0], summary: '' };
      lastNonDateLine = '';
      continue;
    }

    // If the next line is a date range, this line is almost certainly the
    // heading for the *upcoming* entry (role/org), not summary text for the
    // current one — hold onto it instead of appending it.
    const nextIsDate = next && DATE_RANGE_RE.test(next);
    if (nextIsDate) {
      lastNonDateLine = line;
    } else if (currentEntry) {
      currentEntry.summary = (currentEntry.summary + ' ' + line).trim();
    } else {
      lastNonDateLine = line;
    }
  }
  if (currentEntry) entries.push(currentEntry);

  return entries.slice(0, 8).map((e) => ({
    role: e.role.slice(0, 80),
    org: e.org.slice(0, 80),
    period: e.period,
    summary: e.summary.replace(/\s+/g, ' ').trim().slice(0, 240),
  }));
}

function parseResumeText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = splitSections(lines);

  return {
    email: extractEmail(text),
    skills: extractSkills(sections.skills),
    paragraphs: extractParagraphs(sections.summary.length ? sections.summary : lines.slice(0, 6)),
    experience: extractExperience(sections.experience.length ? sections.experience : lines),
  };
}

module.exports = { parseResumeText };
