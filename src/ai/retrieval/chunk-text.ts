export type DocumentChunk = {
  content: string;
  section: string;
  sectionIndex: number;
  chunkIndexInSection: number;
};

const DEFAULT_SECTION_TITLE = 'Introdução';

const normalizeWhitespace = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/[ ]+/g, ' ').trim();

const SECTION_HEADING_PATTERNS: RegExp[] = [
  /^(?:cap[íi]tulo|se[çc][ãa]o|parte|anexo|protocolo|t[óo]pico)\b/i,
  /^(?:\d{1,2}(?:\.\d+)*)\s+\S/,
  /^#{1,4}\s+\S/,
  /^[IVXLC]+\.\s+\S/,
];

const looksLikeSectionHeading = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) {
    return false;
  }

  if (SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (/:\s*$/.test(trimmed) && trimmed.length <= 80) {
    return true;
  }

  return false;
};

type RawSection = {
  heading: string;
  lines: string[];
};

const splitIntoSections = (text: string): Array<{ heading: string; body: string }> => {
  const lines = text.split('\n');
  const sections: RawSection[] = [];
  let current: RawSection = { heading: DEFAULT_SECTION_TITLE, lines: [] };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (current.lines.length > 0) {
        current.lines.push('');
      }
      continue;
    }

    if (looksLikeSectionHeading(trimmed)) {
      const hasContent = current.lines.some((entry) => entry.trim().length > 0);
      if (hasContent || sections.length > 0) {
        sections.push(current);
        current = { heading: trimmed, lines: [] };
        continue;
      }

      current.heading = trimmed;
      continue;
    }

    current.lines.push(line);
  }

  sections.push(current);

  return sections
    .map((section) => ({
      heading: section.heading.trim() || DEFAULT_SECTION_TITLE,
      body: normalizeWhitespace(section.lines.join('\n')),
    }))
    .filter((section) => section.body.length > 0 || section.heading !== DEFAULT_SECTION_TITLE);
};

const chunkBySize = (
  text: string,
  chunkSize: number,
  overlap: number
): string[] => {
  if (!text) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const piece = text.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }
    if (end >= text.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

const buildSectionPrefix = (section: string): string => `[Seção: ${section}]\n`;

const chunkSectionBody = (
  section: string,
  body: string,
  chunkSize: number,
  overlap: number
): string[] => {
  const prefix = buildSectionPrefix(section);
  const maxBodySize = Math.max(chunkSize - prefix.length, 200);
  const bodyChunks = chunkBySize(body, maxBodySize, overlap);

  return bodyChunks.map((piece) => `${prefix}${piece}`);
};

/**
 * Hybrid chunking: split by document section/topic first, then by size for long sections.
 */
export const chunkDocumentText = (
  text: string,
  chunkSize: number,
  overlap: number
): DocumentChunk[] => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const sections = splitIntoSections(normalized);
  const documentChunks: DocumentChunk[] = [];

  sections.forEach((section, sectionIndex) => {
    const sectionChunks = chunkSectionBody(
      section.heading,
      section.body,
      chunkSize,
      overlap
    );

    sectionChunks.forEach((content, chunkIndexInSection) => {
      documentChunks.push({
        content,
        section: section.heading,
        sectionIndex,
        chunkIndexInSection,
      });
    });
  });

  if (!documentChunks.length && normalized) {
    return chunkSectionBody(DEFAULT_SECTION_TITLE, normalized, chunkSize, overlap).map(
      (content, chunkIndexInSection) => ({
        content,
        section: DEFAULT_SECTION_TITLE,
        sectionIndex: 0,
        chunkIndexInSection,
      })
    );
  }

  return documentChunks;
};

/** @deprecated Use chunkDocumentText for section-aware chunking. */
export const chunkText = (
  text: string,
  chunkSize: number,
  overlap: number
): string[] => chunkDocumentText(text, chunkSize, overlap).map((chunk) => chunk.content);
