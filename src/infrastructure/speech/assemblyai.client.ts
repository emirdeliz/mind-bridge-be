import type { AppLanguage } from '@domain/types.js';

import { toAssemblyAiLanguageCode } from './assemblyai-language.js';

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 90_000;

type AssemblyAiTranscriptResponse = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string | null;
  error?: string | null;
};

type AssemblyAiUploadResponse = {
  upload_url: string;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const assemblyAiHeaders = (
  apiKey: string,
  json = false
): Record<string, string> => ({
  authorization: apiKey,
  ...(json ? { 'content-type': 'application/json' } : {}),
});

const parseAssemblyAiError = async (response: Response): Promise<string> => {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return payload.error ?? `AssemblyAI request failed (${response.status})`;
};

const uploadAudio = async (
  apiKey: string,
  audio: Buffer
): Promise<string> => {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
    method: 'POST',
    headers: assemblyAiHeaders(apiKey),
    body: audio,
  });

  if (!response.ok) {
    throw new Error(await parseAssemblyAiError(response));
  }

  const payload = (await response.json()) as AssemblyAiUploadResponse;
  if (!payload.upload_url) {
    throw new Error('AssemblyAI upload response missing upload_url');
  }

  return payload.upload_url;
};

const createTranscript = async (
  apiKey: string,
  uploadUrl: string,
  language: AppLanguage
): Promise<string> => {
  const languageCode = toAssemblyAiLanguageCode(language);

  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: assemblyAiHeaders(apiKey, true),
    body: JSON.stringify({
      audio_url: uploadUrl,
      speech_models: ['universal-2'],
      language_code: languageCode,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseAssemblyAiError(response));
  }

  const payload = (await response.json()) as AssemblyAiTranscriptResponse;
  if (!payload.id) {
    throw new Error('AssemblyAI transcript response missing id');
  }

  return payload.id;
};

const pollTranscript = async (
  apiKey: string,
  transcriptId: string
): Promise<string> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(
      `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
      {
        headers: assemblyAiHeaders(apiKey),
      }
    );

    if (!response.ok) {
      throw new Error(await parseAssemblyAiError(response));
    }

    const payload = (await response.json()) as AssemblyAiTranscriptResponse;

    if (payload.status === 'completed') {
      return payload.text?.trim() ?? '';
    }

    if (payload.status === 'error') {
      throw new Error(payload.error ?? 'AssemblyAI transcription failed');
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('AssemblyAI transcription timed out');
};

export type TranscribeWithAssemblyAiInput = {
  apiKey: string;
  audio: Buffer;
  language?: AppLanguage;
};

export const transcribeWithAssemblyAi = async ({
  apiKey,
  audio,
  language = 'pt',
}: TranscribeWithAssemblyAiInput): Promise<string> => {
  const uploadUrl = await uploadAudio(apiKey, audio);
  const transcriptId = await createTranscript(apiKey, uploadUrl, language);
  return pollTranscript(apiKey, transcriptId);
};
