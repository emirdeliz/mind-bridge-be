import multipart from '@fastify/multipart';
import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist } from '@application/authorization.js';
import { transcribePsychologistSpeech } from '@application/transcribe-psychologist-speech.js';
import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import { BadRequestError } from '@http/errors.js';

const isAppLanguage = (value: string): value is AppLanguage =>
  value === 'pt' || value === 'en' || value === 'es';

export const createPsychologistSpeechRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    await app.register(multipart, {
      limits: {
        fileSize: env.SPEECH_MAX_FILE_BYTES,
        files: 1,
      },
    });

    app.post('/psychologist/speech/transcribe', async (request) => {
      const auth = request.auth!;
      assertPsychologist(auth);

      let audio: Buffer | null = null;
      let mimeType: string | undefined;
      let language: AppLanguage | undefined;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          audio = Buffer.concat(chunks);
          mimeType = part.mimetype;
          continue;
        }

        if (part.type === 'field' && part.fieldname === 'language') {
          const value = String(part.value);
          if (isAppLanguage(value)) {
            language = value;
          }
        }
      }

      if (!audio) {
        throw new BadRequestError('Audio file is required');
      }

      return transcribePsychologistSpeech(env, {
        audio,
        mimeType,
        language,
      });
    });
  };
