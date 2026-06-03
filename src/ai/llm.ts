import { ChatOllama } from "@langchain/ollama";

import type { Env } from "../config/env.js";

export const createChatModel = (env: Env) =>
  new ChatOllama({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_CHAT_MODEL,
    temperature: 0.4,
  });
