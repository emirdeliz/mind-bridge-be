import { recordPatientInteraction } from '@application/enrich-dashboard-snapshot.js';
import {
  transcribeAudio,
  type TranscribeAudioInput,
} from '@application/transcribe-audio.js';
import type { Env } from '@config/env.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TranscribePatientSpeechInput = TranscribeAudioInput;

export const transcribePatientSpeech = async (
  env: Env,
  admin: SupabaseClient,
  patientId: string,
  input: TranscribePatientSpeechInput
): Promise<{ transcript: string }> => {
  const result = await transcribeAudio(env, input);

  await recordPatientInteraction(admin, patientId, {
    channel: 'audio',
    source: 'web',
  });

  return result;
};
