const normalizeWhitespace = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/ +/g, ' ').trim();

export const chunkText = (
  text: string,
  chunkSize: number,
  overlap: number
): string[] => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const piece = normalized.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};
