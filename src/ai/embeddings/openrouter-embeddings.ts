import type { Env } from '@config/env.js';
import { postOpenRouterJson } from '@ai/openrouter/openrouter-https.js';

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_RETRY_DELAY_MS = 500;
const RETRYABLE_EMBEDDING_ERROR =
  /premature close|invalid response body|econnreset|etimedout|socket hang up|fetch failed|network|timed out/i;

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

let embeddingsCircuitOpenUntil = 0;

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
  Accept: 'application/json',
  'HTTP-Referer': env.CORS_ORIGIN,
  'X-Title': 'Mind Bridge',
});

const openEmbeddingsCircuit = (env: Env): void => {
  embeddingsCircuitOpenUntil = Date.now() + env.RAG_EMBEDDING_CIRCUIT_MS;
};

const parseEmbeddingPayload = (rawBody: string): number[][] => {
  let payload: OpenRouterEmbeddingResponse | { error?: string; message?: string };
  try {
    payload = JSON.parse(rawBody) as OpenRouterEmbeddingResponse;
  } catch {
    throw new Error('OpenRouter embeddings returned invalid JSON');
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  const vectors = rows
    .slice()
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((row) => row.embedding)
    .filter((embedding): embedding is number[] => Array.isArray(embedding));

  if (!vectors.length) {
    const apiError =
      typeof payload.error === 'object' && payload.error?.message
        ? payload.error.message
        : typeof payload.error === 'string'
          ? payload.error
          : 'no vectors';
    throw new Error(`OpenRouter embeddings returned no vectors: ${apiError}`);
  }

  return vectors;
};

const requestEmbeddings = async (
  env: Env,
  input: string | string[],
  timeoutMs: number
): Promise<number[][]> => {
  if (Date.now() < embeddingsCircuitOpenUntil) {
    throw new Error('OpenRouter embeddings circuit is open');
  }

  const { status, body } = await postOpenRouterJson(
    OPENROUTER_EMBEDDINGS_URL,
    buildOpenRouterHeaders(env),
    {
      model: env.OPENROUTER_EMBEDDING_MODEL,
      input,
      encoding_format: 'float',
    },
    timeoutMs
  );

  if (status < 200 || status >= 300) {
    throw new Error(
      `OpenRouter embeddings failed (${status}): ${body.slice(0, 240)}`
    );
  }

  return parseEmbeddingPayload(body);
};

const requestEmbeddingsWithRetry = async (
  env: Env,
  input: string | string[],
  timeoutMs: number
): Promise<number[][]> => {
  const maxAttempts = Math.max(1, env.RAG_EMBEDDING_MAX_RETRIES);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestEmbeddings(env, input, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryableEmbeddingError(error) || attempt === maxAttempts) {
        openEmbeddingsCircuit(env);
        throw error;
      }
      await sleep(EMBEDDING_RETRY_DELAY_MS * attempt);
    }
  }

  openEmbeddingsCircuit(env);
  throw lastError instanceof Error
    ? lastError
    : new Error('OpenRouter embeddings failed');
};

const embedBatch = async (
  env: Env,
  texts: string[],
  timeoutMs: number
): Promise<number[][]> => {
  const normalized = texts.map(normalizeEmbeddingInput);
  const input = normalized.length === 1 ? normalized[0]! : normalized;
  return requestEmbeddingsWithRetry(env, input, timeoutMs);
};

export const embedTexts = async (
  env: Env,
  texts: string[],
  options?: {
    onBatchComplete?: (progress: EmbedTextsProgress) => void;
    timeoutMs?: number;
  }
): Promise<number[][]> => {
  if (!texts.length) {
    return [];
  }

  const timeoutMs = options?.timeoutMs ?? env.RAG_EMBEDDING_TIMEOUT_MS;
  const vectors: number[][] = [];
  const batchSize = env.RAG_EMBEDDING_BATCH_SIZE;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batchStartedAt = Date.now();
    const batch = texts.slice(index, index + batchSize);
    const batchVectors = await embedBatch(env, batch, timeoutMs);
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
  query: string,
  options?: { timeoutMs?: number }
): Promise<number[]> => {
  const timeoutMs =
    options?.timeoutMs ?? env.RAG_CHAT_EMBEDDING_TIMEOUT_MS;
  const [vector] = await embedBatch(env, [query], timeoutMs);
  return vector!;
};
