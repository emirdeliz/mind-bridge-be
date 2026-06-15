import { OpenAIEmbeddings } from '@langchain/openai';

import type { Env } from '@config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EMBEDDING_BATCH_SIZE = 32;

export const createOpenRouterEmbeddings = (env: Env): OpenAIEmbeddings =>
  new OpenAIEmbeddings({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_EMBEDDING_MODEL,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });

export const embedTexts = async (
  env: Env,
  texts: string[]
): Promise<number[][]> => {
  if (!texts.length) {
    return [];
  }

  const embeddings = createOpenRouterEmbeddings(env);
  const vectors: number[][] = [];

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const batchVectors = await embeddings.embedDocuments(batch);
    vectors.push(...batchVectors);
  }

  return vectors;
};

export const embedQuery = async (env: Env, query: string): Promise<number[]> => {
  const embeddings = createOpenRouterEmbeddings(env);
  return embeddings.embedQuery(query);
};
