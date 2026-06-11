import type { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '@application/authorization.js';
import type { PatientSessionPayment } from '@domain/patient-payment.types.js';
import { keysToCamel, toSnakeRecord } from '@helpers';

const mapPayment = (row: unknown): PatientSessionPayment => {
  const record = keysToCamel<PatientSessionPayment>(row);
  return {
    id: record.id,
    psychologistId: record.psychologistId,
    patientId: record.patientId,
    billingMonth: record.billingMonth,
    amountCents: record.amountCents,
    paidAt: record.paidAt,
    notes: record.notes ?? null,
  };
};

export const listPatientSessionPaymentsForMonth = async (
  admin: SupabaseClient,
  psychologistId: string,
  billingMonth: string
): Promise<PatientSessionPayment[]> => {
  const { data, error } = await admin
    .from('patient_session_payments')
    .select(
      'id, psychologist_id, patient_id, billing_month, amount_cents, paid_at, notes'
    )
    .eq('psychologist_id', psychologistId)
    .eq('billing_month', billingMonth);

  if (error) {
    throw new Error(`Failed to list patient payments: ${error.message}`);
  }

  return (data ?? []).map(mapPayment);
};

export const listPatientPaymentMonths = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<string[]> => {
  const { data, error } = await admin
    .from('patient_session_payments')
    .select('billing_month')
    .eq('psychologist_id', psychologistId)
    .order('billing_month', { ascending: true });

  if (error) {
    throw new Error(`Failed to list payment months: ${error.message}`);
  }

  const months = new Set<string>();
  for (const row of data ?? []) {
    const month = (row as { billing_month: string }).billing_month;
    if (month) {
      months.add(month);
    }
  }

  return [...months];
};

export type UpsertPatientSessionPaymentInput = {
  psychologistId: string;
  patientId: string;
  billingMonth: string;
  amountCents: number;
  paidAt?: string;
  notes?: string | null;
};

export const upsertPatientSessionPayment = async (
  admin: SupabaseClient,
  input: UpsertPatientSessionPaymentInput
): Promise<PatientSessionPayment> => {
  const paidAt = input.paidAt ?? new Date().toISOString();
  const { data, error } = await admin
    .from('patient_session_payments')
    .upsert(
      toSnakeRecord({
        psychologistId: input.psychologistId,
        patientId: input.patientId,
        billingMonth: input.billingMonth,
        amountCents: input.amountCents,
        paidAt,
        notes: input.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
      }),
      { onConflict: 'psychologist_id,patient_id,billing_month' }
    )
    .select(
      'id, psychologist_id, patient_id, billing_month, amount_cents, paid_at, notes'
    )
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? 'Failed to save patient payment'
    );
  }

  return mapPayment(data);
};

export const deletePatientSessionPayment = async (
  admin: SupabaseClient,
  psychologistId: string,
  paymentId: string
): Promise<void> => {
  const { data, error } = await admin
    .from('patient_session_payments')
    .delete()
    .eq('id', paymentId)
    .eq('psychologist_id', psychologistId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete patient payment: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('Payment not found');
  }
};
