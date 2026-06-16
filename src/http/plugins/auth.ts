import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from 'fastify';

import type { Env } from '@config/env.js';
import type { AuthContext, UserRole } from '@domain/types.js';
import { createUserSupabaseClient } from '@infrastructure/supabase/client.js';
import { getProfileByUserId } from '@infrastructure/supabase/profile.repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
    userSupabase?: ReturnType<typeof createUserSupabaseClient>;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}

const isUserRole = (value: unknown): value is UserRole =>
  value === 'patient' || value === 'psychologist';

const extractBearerToken = (request: FastifyRequest): string => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: missing Bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Unauthorized: empty token');
  }
  return token;
};

/** Register on the root Fastify instance so all route plugins receive the hook. */
export const registerAuthHook = (app: FastifyInstance, env: Env): void => {
  app.addHook('preHandler', async (request) => {
    if (request.routeOptions.config?.public) {
      return;
    }

    const accessToken = extractBearerToken(request);
    const supabase = createUserSupabaseClient(env, accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new Error('Unauthorized: invalid token');
    }

    const profile = await getProfileByUserId(supabase, data.user.id);
    if (!profile || !isUserRole(profile.role)) {
      throw new Error('Unauthorized: profile not found');
    }

    request.auth = {
      userId: data.user.id,
      email: data.user.email ?? profile.email,
      role: profile.role,
      isAdmin: profile.isAdmin,
      accessToken,
    };
    request.userSupabase = supabase;
  });
};

/** @deprecated Prefer registerAuthHook on the root app — encapsulated plugins skip sibling routes. */
export const registerAuthPlugin =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    registerAuthHook(app, env);
  };
