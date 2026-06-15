import type { FastifyPluginAsync } from 'fastify';

import { getProfileByUserId } from '@infrastructure/supabase/profile.repository.js';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request) => {
    const auth = request.auth!;
    const supabase = request.userSupabase!;
    const profile = await getProfileByUserId(supabase, auth.userId);

    return {
      id: auth.userId,
      email: auth.email,
      role: auth.role,
      isAdmin: auth.isAdmin,
      profile,
    };
  });
};
