import { ChatOllama } from '@langchain/ollama';

import type { Env } from '@config/env.js';

export const createChatModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.4,
  });

/** Generation budget for psychologist copilot (brief replies and short numbered lists). */
export const createPsychologistCopilotModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.2,
    numPredict: 384,
    think: false,
  });

/** Patient ↔ AI chat — no post-processing character cap; generous token budget. */
export const createPatientChatModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.2,
    numPredict: 2048,
    think: false,
  });

/** Structured JSON output for dashboard analytics after session end. */
export const createDashboardAnalyticsModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.1,
    numPredict: 512,
  });
