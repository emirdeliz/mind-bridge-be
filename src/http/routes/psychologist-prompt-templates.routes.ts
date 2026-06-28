import type { FastifyPluginAsync } from 'fastify';

import { generateAiPromptTemplateTranslations } from '@application/generate-ai-prompt-template-translations.js';
import { assertPsychologist, NotFoundError } from '@application/authorization.js';
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
  listPsychologistPromptTemplates,
  restorePsychologistPromptTemplateDefault,
  savePsychologistPromptTemplateOverride,
} from '@infrastructure/supabase/psychologist-prompt-template.repository.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';

export const createPsychologistPromptTemplateRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/psychologist/prompt-templates', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);
      const templates = await listPsychologistPromptTemplates(
        admin,
        auth.userId
      );
      return { templates };
    });

    app.get('/psychologist/prompt-templates/tokens', async (request) => {
      assertPsychologist(request.auth);
      return { tokens: AI_PROMPT_TOKEN_DEFINITIONS };
    });

    app.patch(
      '/psychologist/prompt-templates/:key',
      {
        preHandler: [
          validateParams(aiPromptTemplateKeyParamsSchema),
          validateBody(saveAiPromptTemplateBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
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

        const template = await savePsychologistPromptTemplateOverride(
          admin,
          auth.userId,
          key,
          { translations },
          auth.userId
        );

        return { template };
      }
    );

    app.post(
      '/psychologist/prompt-templates/:key/restore',
      { preHandler: validateParams(aiPromptTemplateKeyParamsSchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { key } = request.params as { key: string };

        const template = await restorePsychologistPromptTemplateDefault(
          admin,
          auth.userId,
          key
        );

        return { template };
      }
    );
  };
