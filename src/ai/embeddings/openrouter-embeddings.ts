import OpenAI from 'openai';

import type { Env } from '@config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export type EmbedTextsProgress = {
  batchIndex: number;
  batchSize: number;
  processedChunks: number;
  totalChunks: number;
  durationMs: number;
};

const normalizeEmbeddingInput = (text: string): string => text.replace(/\n/g, ' ');

const createOpenRouterEmbeddingClient = (env: Env): OpenAI =>
  new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: env.RAG_EMBEDDING_TIMEOUT_MS,
    maxRetries: 2,
    defaultHeaders: {
      'HTTP-Referer': env.CORS_ORIGIN,
      'X-Title': 'Mind Bridge',
    },
  });

const embedBatch = async (
  client: OpenAI,
  model: string,
  texts: string[]
): Promise<number[][]> => {
  const { data } = await client.embeddings.create({
    model,
    input: texts.map(normalizeEmbeddingInput),
    // OpenRouter does not reliably support the OpenAI SDK's default base64 path.
    encoding_format: 'float',
  });

  return data
    .slice()
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
};

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

  const client = createOpenRouterEmbeddingClient(env);
  const vectors: number[][] = [];
  const batchSize = env.RAG_EMBEDDING_BATCH_SIZE;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batchStartedAt = Date.now();
    const batch = texts.slice(index, index + batchSize);
    const batchVectors = await embedBatch(
      client,
      env.OPENROUTER_EMBEDDING_MODEL,
      batch
    );
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
  const client = createOpenRouterEmbeddingClient(env);
  const [vector] = await embedBatch(client, env.OPENROUTER_EMBEDDING_MODEL, [
    query,
  ]);
  return vector!;
};
