import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import type { Env } from "../../config/env.js";
import type { AuthContext, UserRole } from "../../domain/types.js";
import { createUserSupabaseClient } from "../../infrastructure/supabase/client.js";
import { getProfileByUserId } from "../../infrastructure/supabase/profile.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
    userSupabase?: ReturnType<typeof createUserSupabaseClient>;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}

const isUserRole = (value: unknown): value is UserRole => value === "patient" || value === "psychologist";

const extractBearerToken = (request: FastifyRequest): string => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing Bearer token");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new Error("Unauthorized: empty token");
  }
  return token;
};

export const registerAuthPlugin = (env: Env): FastifyPluginAsync => async (app) => {
  app.decorateRequest("auth", undefined);
  app.decorateRequest("userSupabase", undefined);

  app.addHook("preHandler", async (request) => {
    if (request.routeOptions.config?.public) {
      return;
    }

    const accessToken = extractBearerToken(request);
    const supabase = createUserSupabaseClient(env, accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new Error("Unauthorized: invalid token");
    }

    const profile = await getProfileByUserId(supabase, data.user.id);
    if (!profile || !isUserRole(profile.role)) {
      throw new Error("Unauthorized: profile not found");
    }

    request.auth = {
      userId: data.user.id,
      email: data.user.email ?? profile.email,
      role: profile.role,
      accessToken,
    };
    request.userSupabase = supabase;
  });
};
