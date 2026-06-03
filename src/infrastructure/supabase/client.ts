import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../../config/env.js";

export const createUserSupabaseClient = (env: Env, accessToken: string): SupabaseClient =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export const createAdminSupabaseClient = (env: Env): SupabaseClient | null => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
