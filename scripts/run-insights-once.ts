import { createAdminSupabaseClient } from '../src/infrastructure/supabase/client.js';
import { loadEnv } from '../src/config/env.js';
import { refreshPsychologistSessionInsights } from '../src/application/refresh-psychologist-session-insights.js';

const patientId = process.argv[2] ?? '11ee1396-fe9a-45a1-a585-264516c1eb64';
const env = loadEnv();
const admin = createAdminSupabaseClient(env);

const started = Date.now();
console.log('refresh start', patientId);

const result = await refreshPsychologistSessionInsights(env, admin, patientId, 'pt');

console.log('refresh done in ms', Date.now() - started);
console.log('summary length', result.psychologistSummary?.length ?? 0);
console.log('insights', result.sessionInsights?.length ?? 0);
