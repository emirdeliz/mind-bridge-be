export const extractStreamChunkContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : typeof part === 'object' && part && 'text' in part
            ? String((part as { text?: string }).text ?? '')
            : ''
      )
      .join('');
  }

  return String(content ?? '');
};
