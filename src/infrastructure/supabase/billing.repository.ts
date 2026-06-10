import type { SupabaseClient } from '@supabase/supabase-js';

import {
  billingMonthBounds,
  countBillablePatientsForMonth,
} from '@domain/billing-month.js';
import type {
  BillingPlatformPricing,
  PsychologistBillingDiscount,
  PsychologistBillingMonthlyEntry,
} from '@domain/billing.types.js';

type PlatformPricingRow = {
  price_per_patient_cents: number;
  currency: string;
};

type DiscountRow = {
  discount_percent: number;
  label: string | null;
};

type MonthlyRow = {
  billing_month: string;
  enabled_patient_count: number;
  unit_price_cents: number;
  gross_amount_cents: number;
  discount_percent: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  is_finalized: boolean;
};

type CareRelationshipBillingRow = {
  patient_id: string;
  created_at: string;
  disabled_at: string | null;
};

const DEFAULT_PRICE_PER_PATIENT_CENTS = 7990;
const DEFAULT_CURRENCY = 'BRL';

export const getBillingPlatformPricing = async (
  admin: SupabaseClient
): Promise<BillingPlatformPricing> => {
  const { data, error } = await admin
    .from('billing_platform_pricing')
    .select('price_per_patient_cents, currency')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load platform pricing: ${error.message}`);
  }

  if (!data) {
    return {
      pricePerPatientCents: DEFAULT_PRICE_PER_PATIENT_CENTS,
      currency: DEFAULT_CURRENCY,
    };
  }

  const row = data as PlatformPricingRow;
  return {
    pricePerPatientCents: row.price_per_patient_cents,
    currency: row.currency ?? DEFAULT_CURRENCY,
  };
};

export const getPsychologistBillingDiscount = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistBillingDiscount | null> => {
  const { data, error } = await admin
    .from('psychologist_billing_discounts')
    .select('discount_percent, label')
    .eq('psychologist_id', psychologistId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing discount: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as DiscountRow;
  return {
    discountPercent: Number(row.discount_percent),
    label: row.label,
  };
};

export const listEnabledPatientIdsForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<string[]> => {
  const { data, error } = await admin
    .from('care_relationships')
    .select('patient_id')
    .eq('psychologist_id', psychologistId)
    .eq('is_deleted', false)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to list enabled patient ids: ${error.message}`);
  }

  return (
    (data as { patient_id: string }[] | null)?.map((row) => row.patient_id) ?? []
  );
};

export const countEnabledPatientsForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<number> => {
  const { count, error } = await admin
    .from('care_relationships')
    .select('id', { count: 'exact', head: true })
    .eq('psychologist_id', psychologistId)
    .eq('is_deleted', false)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to count enabled patients: ${error.message}`);
  }

  return count ?? 0;
};

export const listCareRelationshipsForBilling = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<CareRelationshipBillingRow[]> => {
  const { data, error } = await admin
    .from('care_relationships')
    .select('patient_id, created_at, disabled_at')
    .eq('psychologist_id', psychologistId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to load care relationships for billing: ${error.message}`);
  }

  return (data as CareRelationshipBillingRow[] | null) ?? [];
};

export const countBillablePatientsForPsychologistMonth = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string
): Promise<number> => {
  const relationships = await listCareRelationshipsForBilling(
    admin,
    psychologistId
  );
  const bounds = billingMonthBounds(billingMonth);

  return countBillablePatientsForMonth(
    relationships.map((row) => ({
      patientId: row.patient_id,
      createdAt: row.created_at,
      disabledAt: row.disabled_at,
    })),
    bounds
  );
};

export const listPsychologistIdsWithCareRelationships = async (
  admin: SupabaseClient
): Promise<string[]> => {
  const { data, error } = await admin
    .from('care_relationships')
    .select('psychologist_id')
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to list psychologists for billing: ${error.message}`);
  }

  return [
    ...new Set(
      (data as { psychologist_id: string }[] | null)?.map(
        (row) => row.psychologist_id
      ) ?? []
    ),
  ];
};

export const getPsychologistBillingMonthlyEntry = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string
): Promise<(PsychologistBillingMonthlyEntry & { isFinalized: boolean }) | null> => {
  const { data, error } = await admin
    .from('psychologist_billing_monthly')
    .select(
      'billing_month, enabled_patient_count, unit_price_cents, gross_amount_cents, discount_percent, discount_amount_cents, net_amount_cents, is_finalized'
    )
    .eq('psychologist_id', psychologistId)
    .eq('billing_month', billingMonth)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing month: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as MonthlyRow;
  return {
    ...mapMonthlyRow(row),
    isFinalized: row.is_finalized,
  };
};

export const upsertPsychologistBillingDailySnapshot = async (
  admin: SupabaseClient,
  psychologistId: string,
  snapshotDate: string,
  enabledPatientCount: number,
  patientIds: string[]
): Promise<void> => {
  const { error } = await admin.from('psychologist_billing_daily_snapshots').upsert(
    {
      psychologist_id: psychologistId,
      snapshot_date: snapshotDate,
      enabled_patient_count: enabledPatientCount,
      patient_ids: patientIds,
    },
    { onConflict: 'psychologist_id,snapshot_date' }
  );

  if (error) {
    throw new Error(`Failed to upsert billing daily snapshot: ${error.message}`);
  }
};

const mapMonthlyRow = (row: MonthlyRow): PsychologistBillingMonthlyEntry => ({
  billingMonth: row.billing_month,
  enabledPatientCount: row.enabled_patient_count,
  unitPriceCents: row.unit_price_cents,
  grossAmountCents: row.gross_amount_cents,
  discountPercent: Number(row.discount_percent),
  discountAmountCents: row.discount_amount_cents,
  netAmountCents: row.net_amount_cents,
});

export const listPsychologistBillingMonthly = async (
  admin: SupabaseClient,
  psychologistId: string,
  months = 12
): Promise<PsychologistBillingMonthlyEntry[]> => {
  const { data, error } = await admin
    .from('psychologist_billing_monthly')
    .select(
      'billing_month, enabled_patient_count, unit_price_cents, gross_amount_cents, discount_percent, discount_amount_cents, net_amount_cents'
    )
    .eq('psychologist_id', psychologistId)
    .order('billing_month', { ascending: true })
    .limit(months);

  if (error) {
    throw new Error(`Failed to load billing history: ${error.message}`);
  }

  return (data as MonthlyRow[] | null)?.map(mapMonthlyRow) ?? [];
};

export type UpsertMonthlyBillingPayload = {
  billingMonth: string;
  enabledPatientCount: number;
  unitPriceCents: number;
  grossAmountCents: number;
  discountPercent: number;
  discountAmountCents: number;
  netAmountCents: number;
  isFinalized?: boolean;
};

export const upsertPsychologistBillingMonthly = async (
  admin: SupabaseClient,
  psychologistId: string,
  payload: UpsertMonthlyBillingPayload
): Promise<void> => {
  const existing = await getPsychologistBillingMonthlyEntry(
    admin,
    psychologistId,
    payload.billingMonth
  );

  if (existing?.isFinalized) {
    return;
  }

  const { error } = await admin.from('psychologist_billing_monthly').upsert(
    {
      psychologist_id: psychologistId,
      billing_month: payload.billingMonth,
      enabled_patient_count: payload.enabledPatientCount,
      unit_price_cents: payload.unitPriceCents,
      gross_amount_cents: payload.grossAmountCents,
      discount_percent: payload.discountPercent,
      discount_amount_cents: payload.discountAmountCents,
      net_amount_cents: payload.netAmountCents,
      is_finalized: payload.isFinalized ?? existing?.isFinalized ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'psychologist_id,billing_month' }
  );

  if (error) {
    throw new Error(`Failed to upsert billing month: ${error.message}`);
  }
};
