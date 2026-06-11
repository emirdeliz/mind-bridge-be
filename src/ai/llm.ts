import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';

import type { Env } from '@config/env.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type ChatModelOptions = {
  temperature: number;
  maxOutputTokens?: number;
};

const createGeminiChatModel = (
  env: Env,
  { temperature, maxOutputTokens }: ChatModelOptions
): BaseChatModel =>
  new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: env.GEMINI_CHAT_MODEL,
    temperature,
    maxOutputTokens,
  });

const createOllamaChatModel = (
  env: Env,
  { temperature, maxOutputTokens }: ChatModelOptions
): BaseChatModel =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature,
    numPredict: maxOutputTokens,
    think: false,
  });

const createOpenRouterChatModel = (
  env: Env,
  { temperature, maxOutputTokens }: ChatModelOptions
): BaseChatModel =>
  new ChatOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_CHAT_MODEL,
    temperature,
    maxTokens: maxOutputTokens,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });

const createChatModelForProvider = (
  env: Env,
  options: ChatModelOptions
): BaseChatModel => {
  if (env.LLM_PROVIDER === 'ollama') {
    return createOllamaChatModel(env, options);
  }

  if (env.LLM_PROVIDER === 'openrouter') {
    return createOpenRouterChatModel(env, options);
  }

  return createGeminiChatModel(env, options);
};

export const createChatModel = (env: Env) =>
  createChatModelForProvider(env, { temperature: 0.4 });

/** Generation budget for psychologist copilot (brief replies and short numbered lists). */
export const createPsychologistCopilotModel = (env: Env) =>
  createChatModelForProvider(env, {
    temperature: 0.2,
    maxOutputTokens: 384,
  });

/** Patient ↔ AI chat — brief replies; sentence cap applied in post-processing. */
export const createPatientChatModel = (env: Env) =>
  createChatModelForProvider(env, {
    temperature: 0.15,
    maxOutputTokens: 256,
  });

/** Structured JSON output for dashboard analytics after session end. */
export const createDashboardAnalyticsModel = (env: Env) =>
  createChatModelForProvider(env, {
    temperature: 0.1,
    maxOutputTokens: 512,
  });

/** Weekly cross-conversation insights (patterns + recommended actions) — brief output. */
export const createPatientChatPatternsModel = (env: Env) =>
  createChatModelForProvider(env, {
    temperature: 0.1,
    maxOutputTokens: 192,
  });
