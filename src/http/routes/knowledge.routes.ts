import multipart from '@fastify/multipart';
import type { FastifyPluginAsync } from 'fastify';

import { ingestKnowledgePdf } from '@application/ingest-knowledge-document.js';
import {
  assertKnowledgeDocumentReader,
  assertKnowledgeDocumentUploader,
  assertPsychologist,
} from '@application/authorization.js';
import type { Env } from '@config/env.js';
import { validateParams } from '@http/middleware/validate.js';
import { knowledgeDocumentParamsSchema } from '@http/schemas/knowledge.schemas.js';
import {
  archiveKnowledgeDocument,
  listActiveKnowledgeDocumentsByPsychologist,
} from '@infrastructure/supabase/knowledge.repository.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { BadRequestError } from '@http/errors.js';

export const createKnowledgeRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    await app.register(multipart, {
      limits: {
        fileSize: env.KNOWLEDGE_MAX_FILE_BYTES,
        files: 1,
      },
    });

    app.get('/knowledge/documents', async (request) => {
      const auth = request.auth!;
      assertKnowledgeDocumentReader(auth);
      assertPsychologist(auth);

      const documents = await listActiveKnowledgeDocumentsByPsychologist(
        admin,
        auth.userId
      );
      return {
        documents,
        maxFileBytes: env.KNOWLEDGE_MAX_FILE_BYTES,
      };
    });

    app.post('/knowledge/documents', async (request) => {
      const auth = request.auth!;
      assertKnowledgeDocumentUploader(auth, env.KNOWLEDGE_UPLOAD_ROLE);

      const part = await request.file();
      if (!part) {
        throw new BadRequestError('PDF file is required');
      }

      if (
        part.mimetype &&
        part.mimetype !== 'application/pdf' &&
        !part.filename.toLowerCase().endsWith('.pdf')
      ) {
        throw new BadRequestError('Only PDF files are supported');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of part.file) {
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);
      const fileName = part.filename.trim();
      const title = fileName.replace(/\.pdf$/i, '').trim() || fileName;

      const result = await ingestKnowledgePdf(env, admin, {
        uploadedBy: auth.userId,
        title,
        fileName,
        fileBuffer,
      });

      return {
        document: result.document,
        replaced: result.replaced,
      };
    });

    app.delete(
      '/knowledge/documents/:documentId',
      { preHandler: validateParams(knowledgeDocumentParamsSchema) },
      async (request) => {
        const auth = request.auth!;
        assertKnowledgeDocumentUploader(auth, env.KNOWLEDGE_UPLOAD_ROLE);

        const { documentId } = request.params as { documentId: string };
        const document = await archiveKnowledgeDocument(
          admin,
          documentId,
          auth.userId
        );
        return { document };
      }
    );
  };
