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

/** Patient ↔ AI chat — brief replies; sentence cap applied in post-processing. */
export const createPatientChatModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.15,
    numPredict: 256,
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

/** Weekly cross-conversation pattern detection for psychologist insights. */
export const createPatientChatPatternsModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.12,
    numPredict: 512,
    think: false,
  });
