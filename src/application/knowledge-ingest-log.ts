import type { FastifyBaseLogger } from 'fastify';

export type KnowledgeIngestStage =
  | 'upload-received'
  | 'enqueue-started'
  | 'enqueue-completed'
  | 'index-started'
  | 'status-indexing'
  | 'pdf-parse-started'
  | 'pdf-parse-completed'
  | 'chunking-completed'
  | 'embeddings-started'
  | 'embeddings-batch-completed'
  | 'embeddings-completed'
  | 'chunks-persist-started'
  | 'chunks-persist-completed'
  | 'index-completed'
  | 'index-failed';

export const logKnowledgeIngestStage = (
  logger: FastifyBaseLogger | undefined,
  stage: KnowledgeIngestStage,
  payload: Record<string, unknown>,
  message: string
): void => {
  const entry = { stage, ...payload };

  if (logger) {
    if (stage === 'index-failed') {
      logger.error(entry, message);
      return;
    }
    logger.info(entry, message);
    return;
  }

  const method = stage === 'index-failed' ? console.error : console.log;
  method(`[knowledge-ingest] ${message}`, entry);
};

export const elapsedMs = (startedAt: number): number => Date.now() - startedAt;
