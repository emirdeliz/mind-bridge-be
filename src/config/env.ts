import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Joi from 'joi';

/** Node does not load `.env` automatically; seed uses `--env-file`, dev/start must too or use this. */
const loadDotEnvFile = (): void => {
  const envPath = resolve(process.cwd(), '.env');
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  OLLAMA_BASE_URL: Joi.string().uri().default('http://127.0.0.1:11434'),
  OLLAMA_CHAT_MODEL: Joi.string().default('llama3.2'),
  OLLAMA_EMBEDDING_MODEL: Joi.string().default('nomic-embed-text'),
}).unknown(true);

export type Env = {
  NODE_ENV: string;
  PORT: number;
  CORS_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_CHAT_MODEL: string;
  OLLAMA_EMBEDDING_MODEL: string;
};

export const loadEnv = (): Env => {
  loadDotEnvFile();

  const { value, error } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    throw new Error(
      `Invalid environment: ${error.message}. Ensure mind-bridge-be/.env exists (copy from .env.example, run npm run supabase:env).`
    );
  }

  return value as Env;
};
