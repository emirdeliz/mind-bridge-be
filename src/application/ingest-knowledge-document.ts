import pdfParse from 'pdf-parse';

import type { SupabaseClient } from '@supabase/supabase-js';

import { embedTexts } from '@ai/embeddings/openrouter-embeddings.js';
import { chunkDocumentText } from '@ai/retrieval/chunk-text.js';
import { BadRequestError } from '@http/errors.js';
import type { Env } from '@config/env.js';
import type { KnowledgeDocument } from '@domain/knowledge.types.js';
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
  }
): Promise<{ document: KnowledgeDocument; replaced: boolean }> => {
  assertKnowledgePdfUpload(env, input);

  const title = sanitizeTitle(input.title, input.fileName);
  const existing = await findActiveKnowledgeDocumentByFileName(
    admin,
    input.uploadedBy,
    input.fileName
  );
  if (existing) {
    await archiveKnowledgeDocument(admin, existing.id, input.uploadedBy);
  }

  const document = await insertKnowledgeDocument(admin, {
    title,
    fileName: input.fileName,
    uploadedBy: input.uploadedBy,
    chunkCount: 0,
    indexStatus: 'pending',
  });

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
  }
): Promise<void> => {
  try {
    await updateKnowledgeDocumentIndexStatus(admin, input.documentId, {
      indexStatus: 'indexing',
    });

    const text = await extractPdfText(input.fileBuffer);
    const chunks = chunkDocumentText(
      text,
      env.RAG_CHUNK_SIZE,
      env.RAG_CHUNK_OVERLAP
    );

    if (!chunks.length) {
      throw new BadRequestError('PDF has no indexable text content');
    }

    const embeddings = await embedTexts(
      env,
      chunks.map((chunk) => chunk.content)
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

    await updateKnowledgeDocumentIndexStatus(admin, input.documentId, {
      indexStatus: 'indexed',
      chunkCount: chunks.length,
    });
  } catch {
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
  }
): Promise<{ document: KnowledgeDocument; replaced: boolean }> => {
  const queued = await enqueueKnowledgePdfUpload(env, admin, input);

  await indexKnowledgePdfDocument(env, admin, {
    documentId: queued.document.id,
    title: queued.document.title,
    fileName: input.fileName,
    fileBuffer: input.fileBuffer,
  });

  const document = await getKnowledgeDocumentById(admin, queued.document.id);
  if (!document || document.indexStatus === 'failed') {
    throw new BadRequestError('Failed to index PDF for knowledge retrieval');
  }

  return { document, replaced: queued.replaced };
};
