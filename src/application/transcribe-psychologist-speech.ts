import { transcribeAudio, type TranscribeAudioInput } from '@application/transcribe-audio.js';
import type { Env } from '@config/env.js';

export const transcribePsychologistSpeech = async (
  env: Env,
  input: TranscribeAudioInput
): Promise<{ transcript: string }> => transcribeAudio(env, input);
