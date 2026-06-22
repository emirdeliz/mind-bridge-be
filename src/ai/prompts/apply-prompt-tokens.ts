export const applyPromptTokens = (
  template: string,
  tokens: Record<string, string>
): string =>
  template
    .replace(/#([a-z_]+)/gi, (_match, rawKey: string) => {
      const key = rawKey.toLowerCase();
      return tokens[key] ?? '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const extractPromptTokens = (content: string): string[] => {
  const matches = content.matchAll(/#([a-z_]+)/gi);
  return [...new Set([...matches].map((match) => match[1].toLowerCase()))];
};
