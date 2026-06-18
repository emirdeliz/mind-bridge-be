import { recordPatientInteraction } from '@application/enrich-dashboard-snapshot.js';
import type { Env } from '@config/env.js';
import type { AppLanguage } from '@domain/types.js';
import { BadRequestError } from '@http/errors.js';
import { transcribeWithAssemblyAi } from '@infrastructure/speech/assemblyai.client.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'video/webm',
]);

export type TranscribePatientSpeechInput = {
  audio: Buffer;
  mimeType?: string | null;
  language?: AppLanguage;
};

export const transcribePatientSpeech = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  input: TranscribePatientSpeechInput
): Promise<{ transcript: string }> => {
  const apiKey = env.ASSEMBLYAI_API_KEY.trim();
  if (!apiKey) {
    throw new BadRequestError('Speech transcription is not configured');
  }

  if (!input.audio.byteLength) {
    throw new BadRequestError('Audio file is empty');
  }

  if (input.audio.byteLength > env.SPEECH_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `Audio exceeds maximum size of ${env.SPEECH_MAX_FILE_BYTES} bytes`
    );
  }

  if (
    input.mimeType &&
    !ALLOWED_AUDIO_MIME_TYPES.has(input.mimeType.split(';')[0]?.trim() ?? '')
  ) {
    throw new BadRequestError('Unsupported audio format');
  }

  const transcript = await transcribeWithAssemblyAi({
    apiKey,
    audio: input.audio,
    language: input.language ?? 'pt',
  });

  if (!transcript) {
    throw new BadRequestError('No speech detected in the audio');
  }

  await recordPatientInteraction(admin, patientId, {
    channel: 'audio',
    source: 'web',
  });

  return { transcript };
};
