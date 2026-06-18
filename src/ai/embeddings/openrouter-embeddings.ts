import type { Env } from '@config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const EMBEDDING_RETRY_DELAY_MS = 750;
const RETRYABLE_EMBEDDING_ERROR =
  /premature close|econnreset|etimedout|socket hang up|fetch failed|network/i;

export type EmbedTextsProgress = {
  batchIndex: number;
  batchSize: number;
  processedChunks: number;
  totalChunks: number;
  durationMs: number;
};

type OpenRouterEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  error?: {
    message?: string;
  };
};

const normalizeEmbeddingInput = (text: string): string => text.replace(/\n/g, ' ');

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableEmbeddingError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return RETRYABLE_EMBEDDING_ERROR.test(error.message);
};

const buildOpenRouterHeaders = (env: Env): Record<string, string> => ({
  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': env.CORS_ORIGIN,
  'X-Title': 'Mind Bridge',
});

const requestEmbeddings = async (
  env: Env,
  input: string | string[]
): Promise<number[][]> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.RAG_EMBEDDING_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: buildOpenRouterHeaders(env),
      body: JSON.stringify({
        model: env.OPENROUTER_EMBEDDING_MODEL,
        input,
        encoding_format: 'float',
      }),
      signal: controller.signal,
      keepalive: false,
    });

    const payload = (await response.json().catch(() => ({}))) as
      | OpenRouterEmbeddingResponse
      | { error?: string; message?: string };

    if (!response.ok) {
      const apiError =
        typeof payload === 'object' &&
        payload &&
        'error' in payload &&
        typeof payload.error === 'object' &&
        payload.error &&
        'message' in payload.error
          ? String(payload.error.message)
          : typeof payload === 'object' &&
              payload &&
              'error' in payload &&
              typeof payload.error === 'string'
            ? payload.error
            : typeof payload === 'object' &&
                payload &&
                'message' in payload &&
                typeof payload.message === 'string'
              ? payload.message
              : `HTTP ${response.status}`;
      throw new Error(`OpenRouter embeddings failed: ${apiError}`);
    }

    const rows = Array.isArray(
      (payload as OpenRouterEmbeddingResponse).data
    )
      ? (payload as OpenRouterEmbeddingResponse).data!
      : [];

    const vectors = rows
      .slice()
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((row) => row.embedding)
      .filter((embedding): embedding is number[] => Array.isArray(embedding));

    if (!vectors.length) {
      throw new Error('OpenRouter embeddings returned no vectors');
    }

    return vectors;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `OpenRouter embeddings timed out after ${env.RAG_EMBEDDING_TIMEOUT_MS}ms`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const requestEmbeddingsWithRetry = async (
  env: Env,
  input: string | string[]
): Promise<number[][]> => {
  const maxAttempts = Math.max(1, env.RAG_EMBEDDING_MAX_RETRIES);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestEmbeddings(env, input);
    } catch (error) {
      lastError = error;
      if (!isRetryableEmbeddingError(error) || attempt === maxAttempts) {
        throw error;
      }
      await sleep(EMBEDDING_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('OpenRouter embeddings failed');
};

const embedBatch = async (
  env: Env,
  texts: string[]
): Promise<number[][]> => {
  const normalized = texts.map(normalizeEmbeddingInput);
  const input = normalized.length === 1 ? normalized[0]! : normalized;
  return requestEmbeddingsWithRetry(env, input);
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

  const vectors: number[][] = [];
  const batchSize = env.RAG_EMBEDDING_BATCH_SIZE;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batchStartedAt = Date.now();
    const batch = texts.slice(index, index + batchSize);
    const batchVectors = await embedBatch(env, batch);
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
  const [vector] = await embedBatch(env, [query]);
  return vector!;
};
