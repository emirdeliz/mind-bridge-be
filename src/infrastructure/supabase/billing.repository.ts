import type { SupabaseClient } from '@supabase/supabase-js';

import {
  billingMonthBounds,
  countBillablePatientsForMonth,
  listBillablePatientsForMonth,
} from '@domain/billing-month.js';
import type {
  BillingPlatformPricing,
  PsychologistBillablePatient,
  PsychologistBillingDiscount,
  PsychologistBillingMonthlyEntry,
} from '@domain/billing.types.js';
import { keysToCamel, listKeysToCamel, toSnakeRecord } from '@helpers';

type PatientProfileEmbed = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
};

type CareRelationshipBillingRecord = {
  patientId: string;
  createdAt: string;
  disabledAt: string | null;
  isDeleted: boolean;
  patient: PatientProfileEmbed | PatientProfileEmbed[] | null;
};

type CareRelationshipBilling = {
  patientId: string;
  createdAt: string;
  disabledAt: string | null;
  isDeleted: boolean;
  fullName: string | null;
  email: string | null;
};

type MonthlyBillingRecord = PsychologistBillingMonthlyEntry & {
  isFinalized: boolean;
};

type PatientIdRecord = {
  patientId: string;
};

type PsychologistIdRecord = {
  psychologistId: string;
};

const DEFAULT_PRICE_PER_PATIENT_CENTS = 7990;
const DEFAULT_CURRENCY = 'BRL';

const normalizePatientEmbed = (
  patient: PatientProfileEmbed | PatientProfileEmbed[] | null
): PatientProfileEmbed | null => {
  if (!patient) {
    return null;
  }

  if (Array.isArray(patient)) {
    return patient[0] ?? null;
  }

  return patient;
};

const mapCareRelationshipBilling = (
  row: unknown
): CareRelationshipBilling | null => {
  const record = keysToCamel<CareRelationshipBillingRecord>(row);
  const patient = normalizePatientEmbed(record.patient);

  if (!patient || patient.role !== 'patient') {
    return null;
  }

  return {
    patientId: record.patientId,
    createdAt: record.createdAt,
    disabledAt: record.disabledAt,
    isDeleted: record.isDeleted,
    fullName: patient.fullName,
    email: patient.email,
  };
};

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

  const pricing = keysToCamel<BillingPlatformPricing>(data);
  return {
    pricePerPatientCents: pricing.pricePerPatientCents,
    currency: pricing.currency ?? DEFAULT_CURRENCY,
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

  const discount = keysToCamel<PsychologistBillingDiscount>(data);
  return {
    discountPercent: Number(discount.discountPercent),
    label: discount.label,
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

  return listKeysToCamel<PatientIdRecord>(data ?? []).map(
    (record) => record.patientId
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
): Promise<CareRelationshipBilling[]> => {
  const { data, error } = await admin
    .from('care_relationships')
    .select(
      `
      patient_id,
      created_at,
      disabled_at,
      is_deleted,
      patient:profiles!patient_id (
        id,
        full_name,
        email,
        role
      )
    `
    )
    .eq('psychologist_id', psychologistId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to load care relationships for billing: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => mapCareRelationshipBilling(row))
    .filter((row): row is CareRelationshipBilling => row !== null);
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
    relationships.map((relationship) => ({
      patientId: relationship.patientId,
      fullName: relationship.fullName,
      email: relationship.email,
      createdAt: relationship.createdAt,
      disabledAt: relationship.disabledAt,
      isDeleted: relationship.isDeleted,
    })),
    bounds
  );
};

export const listBillablePatientsForPsychologistMonth = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string
): Promise<PsychologistBillablePatient[]> => {
  const relationships = await listCareRelationshipsForBilling(
    admin,
    psychologistId
  );
  const bounds = billingMonthBounds(billingMonth);

  return listBillablePatientsForMonth(
    relationships.map((relationship) => ({
      patientId: relationship.patientId,
      fullName: relationship.fullName,
      email: relationship.email,
      createdAt: relationship.createdAt,
      disabledAt: relationship.disabledAt,
      isDeleted: relationship.isDeleted,
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
      listKeysToCamel<PsychologistIdRecord>(data ?? []).map(
        (record) => record.psychologistId
      )
    ),
  ];
};

export const getPsychologistBillingMonthlyEntry = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string
): Promise<MonthlyBillingRecord | null> => {
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

  const record = keysToCamel<MonthlyBillingRecord>(data);
  return {
    ...record,
    discountPercent: Number(record.discountPercent),
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
    toSnakeRecord({
      psychologistId,
      snapshotDate,
      enabledPatientCount,
      patientIds,
    }),
    { onConflict: 'psychologist_id,snapshot_date' }
  );

  if (error) {
    throw new Error(`Failed to upsert billing daily snapshot: ${error.message}`);
  }
};

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

  return listKeysToCamel<PsychologistBillingMonthlyEntry>(data ?? []).map(
    (entry) => ({
      ...entry,
      discountPercent: Number(entry.discountPercent),
    })
  );
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
    toSnakeRecord({
      psychologistId,
      billingMonth: payload.billingMonth,
      enabledPatientCount: payload.enabledPatientCount,
      unitPriceCents: payload.unitPriceCents,
      grossAmountCents: payload.grossAmountCents,
      discountPercent: payload.discountPercent,
      discountAmountCents: payload.discountAmountCents,
      netAmountCents: payload.netAmountCents,
      isFinalized: payload.isFinalized ?? existing?.isFinalized ?? false,
      updatedAt: new Date().toISOString(),
    }),
    { onConflict: 'psychologist_id,billing_month' }
  );

  if (error) {
    throw new Error(`Failed to upsert billing month: ${error.message}`);
  }
};
