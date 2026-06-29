import type { FastifyPluginAsync } from 'fastify';

import { generateAiPromptTemplateTranslations } from '@application/generate-ai-prompt-template-translations.js';
import { invalidateAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import { assertAdmin, NotFoundError } from '@application/authorization.js';
import { getAiPromptTemplateDefinition } from '@ai/prompts/ai-prompt-registry.js';
import { listEnrichedAiPromptTokens } from '@application/list-enriched-ai-prompt-tokens.js';
import type { Env } from '@config/env.js';
import type { SaveAiPromptTemplateBody } from '@domain/ai-prompt-template.types.js';
import { validateBody, validateParams } from '@http/middleware/validate.js';
import {
  aiPromptTemplateKeyParamsSchema,
  saveAiPromptTemplateBodySchema,
  testAiPromptTemplateBodySchema,
} from '@http/schemas/ai-prompt-template.schemas.js';
import { testAiPromptTemplate } from '@application/test-psychologist-prompt-template.js';
import type { AppLanguage } from '@domain/types.js';
import {
  listAiPromptTemplates,
  restoreAiPromptTemplateDefault,
  saveAiPromptTemplateOverride,
} from '@infrastructure/supabase/ai-prompt-template.repository.js';
import {
  listAiPromptTemplateDefaults,
  saveAiPromptTemplateDefault,
} from '@infrastructure/supabase/ai-prompt-template-default.repository.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createAdminPromptTemplateRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/admin/prompt-templates', async (request) => {
      assertAdmin(request.auth);
      const templates = await listAiPromptTemplates(admin);
      return { templates };
    });

    app.get('/admin/prompt-templates/tokens', async (request) => {
      assertAdmin(request.auth);
      return { tokens: listEnrichedAiPromptTokens() };
    });

    app.patch(
      '/admin/prompt-templates/:key',
      {
        preHandler: [
          validateParams(aiPromptTemplateKeyParamsSchema),
          validateBody(saveAiPromptTemplateBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertAdmin(auth);
        const { key } = request.params as { key: string };
        const body = request.body as SaveAiPromptTemplateBody;
        const definition = getAiPromptTemplateDefinition(key);
        if (!definition) {
          throw new NotFoundError('Prompt template not found');
        }

        const translations = await generateAiPromptTemplateTranslations(env, {
          content: body.content,
          sourceLanguage: body.sourceLanguage,
          allowedTokens: definition.allowedTokens,
        });

        const template = await saveAiPromptTemplateOverride(
          admin,
          key,
          { translations },
          auth.userId
        );
        invalidateAiPromptTemplateCache();

        return { template };
      }
    );

    const handlePromptTemplateTest = async (
      key: string,
      body: {
        content: string;
        sourceLanguage: AppLanguage;
        testMessage: string;
        psychologistContext?: string;
        sessionConsiderations?: string;
        clinicalContext?: string;
      }
    ) => {
      const definition = getAiPromptTemplateDefinition(key);
      if (!definition) {
        throw new NotFoundError('Prompt template not found');
      }

      return testAiPromptTemplate(env, admin, undefined, {
        key,
        content: body.content,
        sourceLanguage: body.sourceLanguage,
        testMessage: body.testMessage,
        psychologistContext: body.psychologistContext,
        sessionConsiderations: body.sessionConsiderations,
        clinicalContext: body.clinicalContext,
      });
    };

    app.post(
      '/admin/prompt-templates/:key/test',
      {
        preHandler: [
          validateParams(aiPromptTemplateKeyParamsSchema),
          validateBody(testAiPromptTemplateBodySchema),
        ],
      },
      async (request) => {
        assertAdmin(request.auth);
        const { key } = request.params as { key: string };
        const body = request.body as {
          content: string;
          sourceLanguage: AppLanguage;
          testMessage: string;
          psychologistContext?: string;
          sessionConsiderations?: string;
          clinicalContext?: string;
        };

        return handlePromptTemplateTest(key, body);
      }
    );

    app.post(
      '/admin/prompt-templates/:key/restore',
      { preHandler: validateParams(aiPromptTemplateKeyParamsSchema) },
      async (request) => {
        assertAdmin(request.auth);
        const { key } = request.params as { key: string };

        const template = await restoreAiPromptTemplateDefault(admin, key);
        invalidateAiPromptTemplateCache();

        return { template };
      }
    );

    app.get('/admin/prompt-template-defaults', async (request) => {
      assertAdmin(request.auth);
      const templates = await listAiPromptTemplateDefaults(admin);
      return { templates };
    });

    app.post(
      '/admin/prompt-template-defaults/:key/test',
      {
        preHandler: [
          validateParams(aiPromptTemplateKeyParamsSchema),
          validateBody(testAiPromptTemplateBodySchema),
        ],
      },
      async (request) => {
        assertAdmin(request.auth);
        const { key } = request.params as { key: string };
        const body = request.body as {
          content: string;
          sourceLanguage: AppLanguage;
          testMessage: string;
          psychologistContext?: string;
          sessionConsiderations?: string;
          clinicalContext?: string;
        };

        return handlePromptTemplateTest(key, body);
      }
    );

    app.patch(
      '/admin/prompt-template-defaults/:key',
      {
        preHandler: [
          validateParams(aiPromptTemplateKeyParamsSchema),
          validateBody(saveAiPromptTemplateBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertAdmin(auth);
        const { key } = request.params as { key: string };
        const body = request.body as SaveAiPromptTemplateBody;
        const definition = getAiPromptTemplateDefinition(key);
        if (!definition) {
          throw new NotFoundError('Prompt template not found');
        }

        const translations = await generateAiPromptTemplateTranslations(env, {
          content: body.content,
          sourceLanguage: body.sourceLanguage,
          allowedTokens: definition.allowedTokens,
        });

        const template = await saveAiPromptTemplateDefault(
          admin,
          key,
          { translations },
          auth.userId
        );
        invalidateAiPromptTemplateCache();

        return { template };
      }
    );
  };
