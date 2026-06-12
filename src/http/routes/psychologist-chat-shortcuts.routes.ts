import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist } from '@application/authorization.js';
import { generateChatShortcutTranslations } from '@application/generate-chat-shortcut-translations.js';
import type { Env } from '@config/env.js';
import type { PsychologistChatShortcutSaveBody } from '@domain/psychologist-chat-shortcut.types.js';
import {
  validateBody,
  validateParams,
} from '@http/middleware/validate.js';
import {
  chatShortcutIdParamsSchema,
  saveChatShortcutBodySchema,
} from '@http/schemas/psychologist-chat-shortcut.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  createPsychologistChatShortcut,
  deletePsychologistChatShortcut,
  ensureDefaultPsychologistChatShortcuts,
  updatePsychologistChatShortcut,
} from '@infrastructure/supabase/psychologist-chat-shortcut.repository.js';

export const createPsychologistChatShortcutsRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get('/psychologist/chat-shortcuts', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);

      const shortcuts = await ensureDefaultPsychologistChatShortcuts(admin, auth.userId);
      return { shortcuts };
    });

    app.post(
      '/psychologist/chat-shortcuts',
      { preHandler: validateBody(saveChatShortcutBodySchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const body = request.body as PsychologistChatShortcutSaveBody;

        const translations = await generateChatShortcutTranslations(env, body);
        const shortcut = await createPsychologistChatShortcut(
          admin,
          auth.userId,
          translations
        );

        return reply.status(201).send({ shortcut });
      }
    );

    app.patch(
      '/psychologist/chat-shortcuts/:shortcutId',
      {
        preHandler: [
          validateParams(chatShortcutIdParamsSchema),
          validateBody(saveChatShortcutBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { shortcutId } = request.params as { shortcutId: string };
        const body = request.body as PsychologistChatShortcutSaveBody;

        const translations = await generateChatShortcutTranslations(env, body);
        const shortcut = await updatePsychologistChatShortcut(
          admin,
          auth.userId,
          shortcutId,
          translations
        );
        return { shortcut };
      }
    );

    app.delete(
      '/psychologist/chat-shortcuts/:shortcutId',
      { preHandler: validateParams(chatShortcutIdParamsSchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { shortcutId } = request.params as { shortcutId: string };

        await deletePsychologistChatShortcut(admin, auth.userId, shortcutId);
        return reply.status(204).send();
      }
    );
  };
