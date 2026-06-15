import type { SupabaseClient } from '@supabase/supabase-js';

import { embedQuery } from '@ai/embeddings/openrouter-embeddings.js';
import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import { matchKnowledgeChunks } from '@infrastructure/supabase/knowledge.repository.js';
import { normalizeAppLanguage } from '@ai/prompts/psychologist-copilot-system.js';

const MIN_SIMILARITY = 0.2;

const formatKnowledgeRetrievalContext = (
  language: AppLanguage,
  snippets: Array<{
    content: string;
    similarity: number;
    title?: string;
    section?: string;
  }>
): string => {
  if (!snippets.length) {
    return '';
  }

  const labels: Record<
    AppLanguage,
    {
      title: string;
      source: (value: string) => string;
      section: (value: string) => string;
    }
  > = {
    pt: {
      title: 'Base de conhecimento (trechos relevantes do protocolo/documento):',
      source: (value) => `Documento: ${value}`,
      section: (value) => `Seção: ${value}`,
    },
    es: {
      title: 'Base de conocimiento (fragmentos relevantes del protocolo/documento):',
      source: (value) => `Documento: ${value}`,
      section: (value) => `Sección: ${value}`,
    },
    en: {
      title: 'Knowledge base (relevant protocol/document excerpts):',
      source: (value) => `Document: ${value}`,
      section: (value) => `Section: ${value}`,
    },
  };

  const copy = labels[language] ?? labels.pt;
  const lines = snippets.map((snippet, index) => {
    const labelsBlock = [
      typeof snippet.title === 'string' && snippet.title.trim()
        ? copy.source(snippet.title)
        : '',
      typeof snippet.section === 'string' && snippet.section.trim()
        ? copy.section(snippet.section)
        : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const prefix = labelsBlock ? `${labelsBlock}\n` : '';
    return `${index + 1}. ${prefix}${snippet.content.trim()}`;
  });

  return [copy.title, ...lines].join('\n');
};

export const retrieveKnowledgeContext = async (
  env: Env,
  admin: SupabaseClient,
  query: string,
  languageInput?: unknown
): Promise<string> => {
  if (!env.RAG_ENABLED) {
    return '';
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return '';
  }

  const language = normalizeAppLanguage(languageInput);
  const queryEmbedding = await embedQuery(env, normalizedQuery);
  const matches = await matchKnowledgeChunks(admin, {
    queryEmbedding,
    matchCount: env.RAG_TOP_K,
  });

  const relevant = matches.filter((match) => match.similarity >= MIN_SIMILARITY);
  if (!relevant.length) {
    return '';
  }

  return formatKnowledgeRetrievalContext(
    language,
    relevant.map((match) => ({
      content: match.content,
      similarity: match.similarity,
      title:
        typeof match.metadata.title === 'string'
          ? match.metadata.title
          : undefined,
      section:
        typeof match.metadata.section === 'string'
          ? match.metadata.section
          : undefined,
    }))
  );
};
