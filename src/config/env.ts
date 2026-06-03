import Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(4000),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().optional(),
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
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_CHAT_MODEL: string;
  OLLAMA_EMBEDDING_MODEL: string;
};

export const loadEnv = (): Env => {
  const { value, error } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    throw new Error(`Invalid environment: ${error.message}`);
  }

  return value as Env;
};
