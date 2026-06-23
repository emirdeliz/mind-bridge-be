import type { FastifyPluginAsync } from 'fastify';

import { generateAiPromptTemplateTranslations } from '@application/generate-ai-prompt-template-translations.js';
import { invalidateAiPromptTemplateCache } from '@application/ai-prompt-template-cache.js';
import { assertAdmin, NotFoundError } from '@application/authorization.js';
import { getAiPromptTemplateDefinition } from '@ai/prompts/ai-prompt-registry.js';
import { AI_PROMPT_TOKEN_DEFINITIONS } from '@ai/prompts/ai-prompt-tokens.js';
import type { Env } from '@config/env.js';
import type { SaveAiPromptTemplateBody } from '@domain/ai-prompt-template.types.js';
import { validateBody, validateParams } from '@http/middleware/validate.js';
import {
  aiPromptTemplateKeyParamsSchema,
  saveAiPromptTemplateBodySchema,
} from '@http/schemas/ai-prompt-template.schemas.js';
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
      return { tokens: AI_PROMPT_TOKEN_DEFINITIONS };
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
