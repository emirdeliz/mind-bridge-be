import type { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '@application/authorization.js';
import type {
  PsychologistPatientListItem,
  PsychologistPatientSaveBody,
} from '@domain/patient.types.js';
import type { AppLanguage } from '@domain/types.js';
import { keysToCamel, toSnakeRecord } from '@helpers';

import { recordCareBillingEvent } from './billing-events.repository.js';
import { ensurePatientClinicalContent } from './clinical-content.repository.js';

type PatientEmbed = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

type CareRelationshipRecord = {
  isDeleted: boolean;
  lastConsultationAt: string | null;
  patient: PatientEmbed | PatientEmbed[] | null;
};

const normalizePatient = (
  patient: PatientEmbed | PatientEmbed[] | null
): PatientEmbed | null => {
  if (!patient) {
    return null;
  }
  if (Array.isArray(patient)) {
    return patient[0] ?? null;
  }
  return patient;
};

const mapListRow = (
  row: unknown
): PsychologistPatientListItem | null => {
  const record = keysToCamel<CareRelationshipRecord>(row);
  const patient = normalizePatient(record.patient);

  if (!patient || patient.role !== 'patient') {
    return null;
  }

  return {
    id: patient.id,
    fullName: patient.fullName,
    email: patient.email,
    phone: patient.phone,
    lastConsultationAt: record.lastConsultationAt,
    isDeleted: record.isDeleted,
  };
};

export const listPatientsForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  options: { name?: string; includeDeleted?: boolean }
): Promise<PsychologistPatientListItem[]> => {
  let query = admin
    .from('care_relationships')
    .select(
      `
      is_deleted,
      last_consultation_at,
      patient:profiles!patient_id (
        id,
        full_name,
        email,
        phone,
        role
      )
    `
    )
    .eq('psychologist_id', psychologistId);

  if (!options.includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  const name = options.name?.trim();
  if (name) {
    query = query.ilike('patient.full_name', `%${name}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list patients: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((row) => mapListRow(row))
    .filter((row): row is PsychologistPatientListItem => row !== null);
};

export const getPatientForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string,
  options?: { includeDeleted?: boolean }
): Promise<PsychologistPatientListItem | null> => {
  let query = admin
    .from('care_relationships')
    .select(
      `
      is_deleted,
      last_consultation_at,
      patient:profiles!patient_id (
        id,
        full_name,
        email,
        phone,
        role
      )
    `
    )
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId);

  if (!options?.includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to get patient: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapListRow(data);
};

export const createPatientForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  body: PsychologistPatientSaveBody
): Promise<PsychologistPatientListItem> => {
  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!email || !password) {
    throw new Error('Email and password are required to create a patient');
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'patient' },
    });

  if (authError || !authData.user) {
    throw new Error(
      authError?.message ?? 'Failed to create patient auth user'
    );
  }

  const patientId = authData.user.id;

  const { error: profileError } = await admin
    .from('profiles')
    .update(
      toSnakeRecord({
        fullName: body.fullName,
        phone: body.phone ?? null,
        age: body.age ?? null,
        address: body.address ?? null,
        language: body.language ?? 'pt',
        updatedAt: new Date().toISOString(),
      })
    )
    .eq('id', patientId);

  if (profileError) {
    throw new Error(`Failed to update patient profile: ${profileError.message}`);
  }

  const enabledAt = new Date().toISOString();
  const { data: careData, error: careError } = await admin
    .from('care_relationships')
    .insert(
      toSnakeRecord({
        psychologistId,
        patientId,
        status: 'active',
        isDeleted: false,
        disabledAt: null,
        createdAt: enabledAt,
      })
    )
    .select('id')
    .single();

  if (careError || !careData) {
    throw new Error(
      careError?.message ?? 'Failed to create care relationship'
    );
  }

  const careRelationship = keysToCamel<{ id: string }>(careData);

  await recordCareBillingEvent(admin, {
    careRelationshipId: careRelationship.id,
    psychologistId,
    patientId,
    eventType: 'enabled',
    occurredAt: enabledAt,
  });

  await ensurePatientClinicalContent(admin, patientId);

  const created = await getPatientForPsychologist(
    admin,
    psychologistId,
    patientId
  );

  if (!created) {
    throw new Error('Patient created but could not be loaded');
  }

  return created;
};

export const updatePatientForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string,
  body: PsychologistPatientSaveBody
): Promise<PsychologistPatientListItem> => {
  const existing = await getPatientForPsychologist(
    admin,
    psychologistId,
    patientId
  );

  if (!existing) {
    throw new NotFoundError('Patient not found');
  }

  const newPassword = body.password?.trim();
  if (newPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(
      patientId,
      { password: newPassword }
    );

    if (passwordError) {
      throw new Error(
        `Failed to reset patient password: ${passwordError.message}`
      );
    }
  }

  const updatePayload: Record<string, unknown> = {
    fullName: body.fullName,
    phone: body.phone ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (body.age !== undefined) {
    updatePayload.age = body.age;
  }
  if (body.address !== undefined) {
    updatePayload.address = body.address;
  }
  if (body.language !== undefined) {
    updatePayload.language = body.language as AppLanguage;
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update(toSnakeRecord(updatePayload))
    .eq('id', patientId)
    .eq('role', 'patient');

  if (profileError) {
    throw new Error(`Failed to update patient: ${profileError.message}`);
  }

  const updated = await getPatientForPsychologist(
    admin,
    psychologistId,
    patientId
  );

  if (!updated) {
    throw new Error('Patient updated but could not be loaded');
  }

  return updated;
};

export const softDeletePatientForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string
): Promise<void> => {
  const disabledAt = new Date().toISOString();
  const { data, error } = await admin
    .from('care_relationships')
    .update(
      toSnakeRecord({
        isDeleted: true,
        disabledAt,
      })
    )
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete patient: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('Patient not found');
  }

  const careRelationship = keysToCamel<{ id: string }>(data);

  await recordCareBillingEvent(admin, {
    careRelationshipId: careRelationship.id,
    psychologistId,
    patientId,
    eventType: 'disabled',
    occurredAt: disabledAt,
  });
};
