import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminPlatformMetricsPoint } from '@domain/admin.types.js';
import { keysToCamel, listKeysToCamel } from '@helpers';

type MonthlyBillingRow = {
  billingMonth: string;
  psychologistId: string;
  enabledPatientCount: number;
  netAmountCents: number;
};

export type PlatformCareRelationship = {
  psychologistId: string;
  patientId: string;
  createdAt: string;
  disabledAt: string | null;
  isDeleted: boolean;
};

type PlatformCareRelationshipRow = {
  psychologistId: string;
  patientId: string;
  createdAt: string;
  disabledAt: string | null;
  isDeleted: boolean;
};

export const listPlatformCareRelationships = async (
  admin: SupabaseClient
): Promise<PlatformCareRelationship[]> => {
  const { data, error } = await admin
    .from('care_relationships')
    .select('psychologist_id, patient_id, created_at, disabled_at, is_deleted')
    .eq('status', 'active');

  if (error) {
    throw new Error(
      `Failed to load platform care relationships: ${error.message}`
    );
  }

  return listKeysToCamel<PlatformCareRelationshipRow>(data ?? []);
};

export const listPlatformBillingRowsForMonths = async (
  admin: SupabaseClient,
  billingMonths: string[]
): Promise<MonthlyBillingRow[]> => {
  if (!billingMonths.length) {
    return [];
  }

  const { data, error } = await admin
    .from('psychologist_billing_monthly')
    .select(
      'billing_month, psychologist_id, enabled_patient_count, net_amount_cents'
    )
    .in('billing_month', billingMonths);

  if (error) {
    throw new Error(
      `Failed to load platform billing metrics: ${error.message}`
    );
  }

  return listKeysToCamel<MonthlyBillingRow>(data ?? []);
};

export const aggregatePlatformBillingByMonth = (
  billingMonths: string[],
  rows: MonthlyBillingRow[]
): AdminPlatformMetricsPoint[] => {
  const byMonth = new Map<string, AdminPlatformMetricsPoint>();

  for (const billingMonth of billingMonths) {
    byMonth.set(billingMonth, {
      periodStart: billingMonth,
      activePsychologists: 0,
      activePatients: 0,
      revenueCents: 0,
    });
  }

  const psychologistsByMonth = new Map<string, Set<string>>();

  for (const row of rows) {
    const point = byMonth.get(row.billingMonth);
    if (!point) {
      continue;
    }

    if (row.enabledPatientCount > 0) {
      const psychologists =
        psychologistsByMonth.get(row.billingMonth) ?? new Set<string>();
      psychologists.add(row.psychologistId);
      psychologistsByMonth.set(row.billingMonth, psychologists);
    }

    point.activePatients += row.enabledPatientCount;
    point.revenueCents += row.netAmountCents;
  }

  for (const [billingMonth, psychologists] of psychologistsByMonth.entries()) {
    const point = byMonth.get(billingMonth);
    if (point) {
      point.activePsychologists = psychologists.size;
    }
  }

  return billingMonths.map((billingMonth) => byMonth.get(billingMonth)!);
};

export const getPlatformCurrency = async (
  admin: SupabaseClient
): Promise<string> => {
  const { data, error } = await admin
    .from('billing_platform_pricing')
    .select('currency')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load platform currency: ${error.message}`);
  }

  return keysToCamel<{ currency: string }>(data ?? { currency: 'BRL' })
    .currency;
};
