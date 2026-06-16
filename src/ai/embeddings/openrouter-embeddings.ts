import { OpenAIEmbeddings } from '@langchain/openai';

import type { Env } from '@config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type EmbedTextsProgress = {
  batchIndex: number;
  batchSize: number;
  processedChunks: number;
  totalChunks: number;
  durationMs: number;
};

export const createOpenRouterEmbeddings = (env: Env): OpenAIEmbeddings =>
  new OpenAIEmbeddings({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_EMBEDDING_MODEL,
    timeout: env.RAG_EMBEDDING_TIMEOUT_MS,
    maxRetries: 2,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });

export const embedTexts = async (
  env: Env,
  texts: string[],
  options?: {
    onBatchComplete?: (progress: EmbedTextsProgress) => void;
  }
): Promise<number[][]> => {
  if (!texts.length) {
    return [];
  }

  const embeddings = createOpenRouterEmbeddings(env);
  const vectors: number[][] = [];
  const batchSize = env.RAG_EMBEDDING_BATCH_SIZE;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batchStartedAt = Date.now();
    const batch = texts.slice(index, index + batchSize);
    const batchVectors = await embeddings.embedDocuments(batch);
    vectors.push(...batchVectors);

    options?.onBatchComplete?.({
      batchIndex: Math.floor(index / batchSize) + 1,
      batchSize: batch.length,
      processedChunks: vectors.length,
      totalChunks: texts.length,
      durationMs: Date.now() - batchStartedAt,
    });
  }

  return vectors;
};

export const embedQuery = async (
  env: Env,
  query: string
): Promise<number[]> => {
  const embeddings = createOpenRouterEmbeddings(env);
  return embeddings.embedQuery(query);
};
