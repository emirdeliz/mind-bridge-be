import pdfParse from 'pdf-parse';

import type { FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

import { embedTexts } from '@ai/embeddings/openrouter-embeddings.js';
import { chunkDocumentText } from '@ai/retrieval/chunk-text.js';
import { BadRequestError } from '@http/errors.js';
import type { Env } from '@config/env.js';
import type { KnowledgeDocument } from '@domain/knowledge.types.js';
import {
  elapsedMs,
  logKnowledgeIngestStage,
} from '@application/knowledge-ingest-log.js';
import {
  archiveKnowledgeDocument,
  findActiveKnowledgeDocumentByFileName,
  getKnowledgeDocumentById,
  insertKnowledgeChunks,
  insertKnowledgeDocument,
  updateKnowledgeDocumentIndexStatus,
} from '@infrastructure/supabase/knowledge.repository.js';

const MAX_TITLE_LENGTH = 200;

const sanitizeTitle = (title: string, fileName: string): string => {
  const normalized = title.trim() || fileName.replace(/\.pdf$/i, '').trim();
  if (!normalized) {
    throw new BadRequestError('Document title is required');
  }
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw new BadRequestError(
      `Document title must be at most ${MAX_TITLE_LENGTH} characters`
    );
  }
  return normalized;
};

const assertKnowledgePdfUpload = (
  env: Env,
  input: { fileName: string; fileBuffer: Buffer }
): void => {
  if (!env.RAG_ENABLED) {
    throw new BadRequestError('Knowledge RAG is disabled on this server');
  }

  if (!input.fileName.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestError('Only PDF files are supported');
  }

  if (input.fileBuffer.byteLength > env.KNOWLEDGE_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `PDF exceeds maximum size of ${env.KNOWLEDGE_MAX_FILE_BYTES} bytes`
    );
  }
};

export const extractPdfText = async (buffer: Buffer): Promise<string> => {
  try {
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? '';
    if (!text) {
      throw new BadRequestError(
        'Could not extract text from PDF. The file may be scanned or image-only.'
      );
    }
    return text;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new BadRequestError('Invalid or corrupted PDF file');
  }
};

export const enqueueKnowledgePdfUpload = async (
  env: Env,
  admin: SupabaseClient,
  input: {
    uploadedBy: string;
    title: string;
    fileName: string;
    fileBuffer: Buffer;
  },
  logger?: FastifyBaseLogger
): Promise<{ document: KnowledgeDocument; replaced: boolean }> => {
  const startedAt = Date.now();

  logKnowledgeIngestStage(
    logger,
    'enqueue-started',
    {
      fileName: input.fileName,
      uploadedBy: input.uploadedBy,
      fileSizeBytes: input.fileBuffer.byteLength,
    },
    'Knowledge PDF enqueue started'
  );

  assertKnowledgePdfUpload(env, input);

  const title = sanitizeTitle(input.title, input.fileName);
  const existing = await findActiveKnowledgeDocumentByFileName(
    admin,
    input.uploadedBy,
    input.fileName
  );
  if (existing) {
    await archiveKnowledgeDocument(admin, existing.id, input.uploadedBy);
    logKnowledgeIngestStage(
      logger,
      'enqueue-started',
      {
        fileName: input.fileName,
        replacedDocumentId: existing.id,
      },
      'Knowledge PDF replaced existing active document'
    );
  }

  const document = await insertKnowledgeDocument(admin, {
    title,
    fileName: input.fileName,
    uploadedBy: input.uploadedBy,
    chunkCount: 0,
    indexStatus: 'pending',
  });

  logKnowledgeIngestStage(
    logger,
    'enqueue-completed',
    {
      documentId: document.id,
      fileName: input.fileName,
      replaced: Boolean(existing),
      durationMs: elapsedMs(startedAt),
    },
    'Knowledge PDF enqueued for indexing'
  );

  return { document, replaced: Boolean(existing) };
};

export const indexKnowledgePdfDocument = async (
  env: Env,
  admin: SupabaseClient,
  input: {
    documentId: string;
    title: string;
    fileName: string;
    fileBuffer: Buffer;
  },
  logger?: FastifyBaseLogger
): Promise<void> => {
  const indexStartedAt = Date.now();

  logKnowledgeIngestStage(
    logger,
    'index-started',
    {
      documentId: input.documentId,
      fileName: input.fileName,
      fileSizeBytes: input.fileBuffer.byteLength,
    },
    'Knowledge PDF background indexing started'
  );

  try {
    await updateKnowledgeDocumentIndexStatus(admin, input.documentId, {
      indexStatus: 'indexing',
    });

    logKnowledgeIngestStage(
      logger,
      'status-indexing',
      { documentId: input.documentId, fileName: input.fileName },
      'Knowledge document status set to indexing'
    );

    const parseStartedAt = Date.now();
    logKnowledgeIngestStage(
      logger,
      'pdf-parse-started',
      { documentId: input.documentId, fileName: input.fileName },
      'Knowledge PDF text extraction started'
    );

    const text = await extractPdfText(input.fileBuffer);

    logKnowledgeIngestStage(
      logger,
      'pdf-parse-completed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        textLength: text.length,
        durationMs: elapsedMs(parseStartedAt),
      },
      'Knowledge PDF text extraction completed'
    );

    const chunkStartedAt = Date.now();
    const chunks = chunkDocumentText(
      text,
      env.RAG_CHUNK_SIZE,
      env.RAG_CHUNK_OVERLAP
    );

    if (!chunks.length) {
      throw new BadRequestError('PDF has no indexable text content');
    }

    logKnowledgeIngestStage(
      logger,
      'chunking-completed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
        chunkSize: env.RAG_CHUNK_SIZE,
        chunkOverlap: env.RAG_CHUNK_OVERLAP,
        durationMs: elapsedMs(chunkStartedAt),
      },
      'Knowledge PDF chunking completed'
    );

    const embeddingsStartedAt = Date.now();
    logKnowledgeIngestStage(
      logger,
      'embeddings-started',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
        embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
      },
      'Knowledge PDF embedding generation started'
    );

    const embeddings = await embedTexts(
      env,
      chunks.map((chunk) => chunk.content),
      {
        onBatchComplete: ({
          batchIndex,
          batchSize,
          processedChunks,
          totalChunks,
          durationMs,
        }) => {
          logKnowledgeIngestStage(
            logger,
            'embeddings-batch-completed',
            {
              documentId: input.documentId,
              fileName: input.fileName,
              batchIndex,
              batchSize,
              processedChunks,
              totalChunks,
              durationMs,
            },
            'Knowledge PDF embedding batch completed'
          );
        },
      }
    );

    logKnowledgeIngestStage(
      logger,
      'embeddings-completed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
        vectorsGenerated: embeddings.length,
        durationMs: elapsedMs(embeddingsStartedAt),
      },
      'Knowledge PDF embedding generation completed'
    );

    const persistStartedAt = Date.now();
    logKnowledgeIngestStage(
      logger,
      'chunks-persist-started',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
      },
      'Knowledge PDF chunk persistence started'
    );

    await insertKnowledgeChunks(
      admin,
      chunks.map((chunk, chunkIndex) => ({
        documentId: input.documentId,
        chunkIndex,
        content: chunk.content,
        metadata: {
          title: input.title,
          fileName: input.fileName,
          section: chunk.section,
          sectionIndex: chunk.sectionIndex,
          chunkIndexInSection: chunk.chunkIndexInSection,
          chunkIndex,
        },
        embedding: embeddings[chunkIndex]!,
      }))
    );

    logKnowledgeIngestStage(
      logger,
      'chunks-persist-completed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
        durationMs: elapsedMs(persistStartedAt),
      },
      'Knowledge PDF chunk persistence completed'
    );

    await updateKnowledgeDocumentIndexStatus(admin, input.documentId, {
      indexStatus: 'indexed',
      chunkCount: chunks.length,
    });

    logKnowledgeIngestStage(
      logger,
      'index-completed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        chunkCount: chunks.length,
        durationMs: elapsedMs(indexStartedAt),
      },
      'Knowledge PDF indexing completed'
    );
  } catch (error) {
    logKnowledgeIngestStage(
      logger,
      'index-failed',
      {
        documentId: input.documentId,
        fileName: input.fileName,
        durationMs: elapsedMs(indexStartedAt),
        err: error instanceof Error ? error.message : String(error),
      },
      'Knowledge PDF indexing failed'
    );

    await updateKnowledgeDocumentIndexStatus(admin, input.documentId, {
      indexStatus: 'failed',
    }).catch(() => undefined);
  }
};

export const ingestKnowledgePdf = async (
  env: Env,
  admin: SupabaseClient,
  input: {
    uploadedBy: string;
    title: string;
    fileName: string;
    fileBuffer: Buffer;
  },
  logger?: FastifyBaseLogger
): Promise<{ document: KnowledgeDocument; replaced: boolean }> => {
  const queued = await enqueueKnowledgePdfUpload(env, admin, input, logger);

  await indexKnowledgePdfDocument(
    env,
    admin,
    {
      documentId: queued.document.id,
      title: queued.document.title,
      fileName: input.fileName,
      fileBuffer: input.fileBuffer,
    },
    logger
  );

  const document = await getKnowledgeDocumentById(admin, queued.document.id);
  if (!document || document.indexStatus === 'failed') {
    throw new BadRequestError('Failed to index PDF for knowledge retrieval');
  }

  return { document, replaced: queued.replaced };
};
