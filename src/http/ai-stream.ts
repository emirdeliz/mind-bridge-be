import type { FastifyReply } from 'fastify';

import type { ClinicalChatMessage } from '@domain/clinical-content.types.js';

export type AiStreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'done'; message: string; messages?: ClinicalChatMessage[] }
  | { type: 'error'; error: string };

export const wantsAiStream = (request: {
  query?: unknown;
  headers?: { accept?: string };
}): boolean => {
  const query = request.query as { stream?: string } | undefined;
  if (query?.stream === '1' || query?.stream === 'true') {
    return true;
  }

  return Boolean(request.headers?.accept?.includes('text/event-stream'));
};

export const writeAiStreamEvent = (
  reply: FastifyReply,
  event: AiStreamEvent
): void => {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const startAiStream = (reply: FastifyReply): void => {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
};

export const endAiStream = (reply: FastifyReply): void => {
  reply.raw.end();
};
