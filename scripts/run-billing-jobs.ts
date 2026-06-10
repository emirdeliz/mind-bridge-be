#!/usr/bin/env node
/**
 * Billing maintenance jobs (run daily via cron).
 * Usage:
 *   tsx --env-file=.env scripts/run-billing-jobs.ts snapshot
 *   tsx --env-file=.env scripts/run-billing-jobs.ts finalize
 *   tsx --env-file=.env scripts/run-billing-jobs.ts all
 */

import { createClient } from '@supabase/supabase-js';

import { finalizePreviousBillingMonth } from '../src/application/finalize-previous-billing-month.js';
import { runBillingDailySnapshot } from '../src/application/run-billing-daily-snapshot.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const command = process.argv[2] ?? 'all';

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = async () => {
  if (!['snapshot', 'finalize', 'all'].includes(command)) {
    console.error('Unknown command. Use: snapshot | finalize | all');
    process.exit(1);
  }

  if (command === 'snapshot' || command === 'all') {
    const snapshot = await runBillingDailySnapshot(admin);
    console.log(
      `Daily snapshot complete for ${snapshot.psychologistsProcessed} psychologist(s).`
    );
  }

  if (command === 'finalize' || command === 'all') {
    const finalized = await finalizePreviousBillingMonth(admin);
    console.log(
      `Finalized billing month ${finalized.billingMonth} for ${finalized.psychologistsProcessed} psychologist(s).`
    );
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
