import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Joi from 'joi';

/** Node does not load `.env` automatically; load `.env` then `.env.local` (local overrides). */
const loadEnvFile = (filename: string, override: boolean): void => {
  const envPath = resolve(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const loadDotEnvFiles = (): void => {
  loadEnvFile('.env', false);
  loadEnvFile('.env.local', true);
};

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3001'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  LLM_PROVIDER: Joi.string()
    .valid('gemini', 'ollama', 'openrouter')
    .default('gemini'),
  GOOGLE_GENERATIVE_AI_API_KEY: Joi.when('LLM_PROVIDER', {
    is: 'gemini',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  GEMINI_CHAT_MODEL: Joi.string().default('gemini-2.0-flash'),
  OPENROUTER_API_KEY: Joi.when('LLM_PROVIDER', {
    is: 'openrouter',
    then: Joi.string().min(1).required(),
    otherwise: Joi.when('RAG_ENABLED', {
      is: true,
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().allow('').optional(),
    }),
  }),
  OPENROUTER_CHAT_MODEL: Joi.string().default(
    'google/gemma-2-9b-it:free'
  ),
  OLLAMA_BASE_URL: Joi.string().uri().default('http://127.0.0.1:11434'),
  OLLAMA_CHAT_MODEL: Joi.string().default('gemma4'),
  OLLAMA_EMBEDDING_MODEL: Joi.string().default('nomic-embed-text'),
  RAG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OPENROUTER_EMBEDDING_MODEL: Joi.string().default(
    'openai/text-embedding-3-small'
  ),
  RAG_TOP_K: Joi.number().integer().min(1).max(20).default(5),
  RAG_CHUNK_SIZE: Joi.number().integer().min(200).max(4000).default(800),
  RAG_CHUNK_OVERLAP: Joi.number().integer().min(0).max(1000).default(120),
  KNOWLEDGE_UPLOAD_ROLE: Joi.string()
    .valid('admin', 'psychologist')
    .default('admin'),
  KNOWLEDGE_MAX_FILE_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(52_428_800)
    .default(10_485_760),
}).unknown(true);

export type Env = {
  NODE_ENV: string;
  PORT: number;
  CORS_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LLM_PROVIDER: 'gemini' | 'ollama' | 'openrouter';
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  GEMINI_CHAT_MODEL: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_CHAT_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_CHAT_MODEL: string;
  OLLAMA_EMBEDDING_MODEL: string;
  RAG_ENABLED: boolean;
  OPENROUTER_EMBEDDING_MODEL: string;
  RAG_TOP_K: number;
  RAG_CHUNK_SIZE: number;
  RAG_CHUNK_OVERLAP: number;
  KNOWLEDGE_UPLOAD_ROLE: 'admin' | 'psychologist';
  KNOWLEDGE_MAX_FILE_BYTES: number;
};

export const loadEnv = (): Env => {
  loadDotEnvFiles();

  const { value, error } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });

  if (error) {
    throw new Error(
      `Invalid environment: ${error.message}. Copy mind-bridge-be/.env.example to .env and set Supabase + LLM keys.`
    );
  }

  return value as Env;
};
