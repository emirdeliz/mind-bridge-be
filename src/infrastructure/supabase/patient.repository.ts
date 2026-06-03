import type { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '@application/authorization.js';
import type {
  PsychologistPatientListItem,
  PsychologistPatientSaveBody,
} from '@domain/patient.types.js';
import type { AppLanguage } from '@domain/types.js';

type PatientEmbed = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

type CareRelationshipRow = {
  is_deleted: boolean;
  last_consultation_at: string | null;
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
  row: CareRelationshipRow
): PsychologistPatientListItem | null => {
  const patient = normalizePatient(row.patient);
  if (!patient || patient.role !== 'patient') {
    return null;
  }

  return {
    id: patient.id,
    fullName: patient.full_name,
    phone: patient.phone,
    lastConsultationAt: row.last_consultation_at,
    isDeleted: row.is_deleted,
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

  return (data as CareRelationshipRow[])
    .map(mapListRow)
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

  return mapListRow(data as CareRelationshipRow);
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
    .update({
      full_name: body.fullName,
      phone: body.phone ?? null,
      age: body.age ?? null,
      address: body.address ?? null,
      language: body.language ?? 'pt',
      updated_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  if (profileError) {
    throw new Error(`Failed to update patient profile: ${profileError.message}`);
  }

  const { error: careError } = await admin.from('care_relationships').insert({
    psychologist_id: psychologistId,
    patient_id: patientId,
    status: 'active',
    is_deleted: false,
  });

  if (careError) {
    throw new Error(
      `Failed to create care relationship: ${careError.message}`
    );
  }

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
    full_name: body.fullName,
    phone: body.phone ?? null,
    updated_at: new Date().toISOString(),
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
    .update(updatePayload)
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
  const { data, error } = await admin
    .from('care_relationships')
    .update({ is_deleted: true })
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
};
