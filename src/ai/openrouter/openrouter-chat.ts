import { request as httpsRequest } from 'node:https';

import type { Env } from '@config/env.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterChatStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

const buildOpenRouterHeaders = (
  env: Env,
  contentLength: number
): Record<string, string> => ({
  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'text/event-stream',
  'HTTP-Referer': env.CORS_ORIGIN,
  'X-Title': 'Mind Bridge',
  'Content-Length': String(contentLength),
});

const parseSseLines = (
  buffer: string,
  onDelta: (delta: string) => void
): { remainder: string; content: string } => {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';
  let content = '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) {
      continue;
    }

    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as OpenRouterChatStreamChunk;
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        content += delta;
        onDelta(delta);
      }
    } catch {
      // Ignore malformed SSE chunks.
    }
  }

  return { remainder, content };
};

export const streamOpenRouterChat = async (
  env: Env,
  messages: OpenRouterChatMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    timeoutMs?: number;
  },
  onDelta: (delta: string) => void
): Promise<string> => {
  const body = JSON.stringify({
    model: env.OPENROUTER_CHAT_MODEL,
    messages,
    stream: true,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });
  const timeoutMs = options.timeoutMs ?? 90_000;

  return new Promise((resolve, reject) => {
    const parsed = new URL(OPENROUTER_CHAT_URL);
    const req = httpsRequest(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: buildOpenRouterHeaders(env, Buffer.byteLength(body)),
      },
      (res) => {
        if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
          const errorChunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => errorChunks.push(chunk));
          res.on('end', () => {
            reject(
              new Error(
                `OpenRouter chat failed (${res.statusCode ?? 500}): ${Buffer.concat(errorChunks).toString('utf8').slice(0, 240)}`
              )
            );
          });
          res.on('error', reject);
          return;
        }

        let buffer = '';
        let fullText = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          const parsedLines = parseSseLines(buffer, onDelta);
          buffer = parsedLines.remainder;
          fullText += parsedLines.content;
        });

        res.on('end', () => {
          if (buffer.trim()) {
            const parsedLines = parseSseLines(`${buffer}\n`, onDelta);
            fullText += parsedLines.content;
          }
          resolve(fullText);
        });

        res.on('error', reject);
      }
    );

    const timeout = setTimeout(() => {
      req.destroy(new Error(`OpenRouter chat timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    req.on('close', () => {
      clearTimeout(timeout);
    });

    req.write(body);
    req.end();
  });
};

export const invokeOpenRouterChat = async (
  env: Env,
  messages: OpenRouterChatMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    timeoutMs?: number;
  }
): Promise<string> => {
  let content = '';
  await streamOpenRouterChat(env, messages, options, (delta) => {
    content += delta;
  });
  return content;
};
