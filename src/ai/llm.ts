import { ChatOllama } from '@langchain/ollama';

import type { Env } from '@config/env.js';

export const createChatModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.4,
  });

/** Tighter generation budget for in-session psychologist copilot replies. */
export const createPsychologistCopilotModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.2,
    numPredict: 96,
  });

/** Structured JSON output for dashboard analytics after session end. */
export const createDashboardAnalyticsModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.1,
    numPredict: 512,
  });
