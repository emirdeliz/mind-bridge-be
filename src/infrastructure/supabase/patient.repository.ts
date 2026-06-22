import type { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '@application/authorization.js';
import type {
  PatientSelfRegisterBody,
  PsychologistPatientListItem,
  PsychologistPatientSaveBody,
} from '@domain/patient.types.js';
import type { AppLanguage } from '@domain/types.js';
import { keysToCamel, toSnakeRecord } from '@helpers';

import { recordCareBillingEvent } from './billing-events.repository.js';
import { ensurePatientClinicalContent } from './clinical-content.repository.js';
import {
  InvalidInviteCodeError,
  resolvePsychologistIdByInviteCode,
} from './invite-code.repository.js';

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

const mapListRow = (row: unknown): PsychologistPatientListItem | null => {
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

export const linkPatientToPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string
): Promise<void> => {
  const { data: existingLink, error: existingError } = await admin
    .from('care_relationships')
    .select('id, is_deleted')
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to check care relationship: ${existingError.message}`
    );
  }

  if (existingLink) {
    if (existingLink.is_deleted) {
      const enabledAt = new Date().toISOString();
      const { error: restoreError } = await admin
        .from('care_relationships')
        .update({
          is_deleted: false,
          disabled_at: null,
          status: 'active',
        })
        .eq('id', existingLink.id);

      if (restoreError) {
        throw new Error(
          `Failed to restore care relationship: ${restoreError.message}`
        );
      }

      await recordCareBillingEvent(admin, {
        careRelationshipId: existingLink.id as string,
        psychologistId,
        patientId,
        eventType: 'enabled',
        occurredAt: enabledAt,
      });
    }

    await ensurePatientClinicalContent(admin, patientId);
    return;
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
    throw new Error(careError?.message ?? 'Failed to create care relationship');
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
};

export { InvalidInviteCodeError };

export const registerPatientWithInviteCode = async (
  admin: SupabaseClient,
  body: PatientSelfRegisterBody
): Promise<void> => {
  const email = body.email.trim();
  const password = body.password.trim();
  const phone = body.phone.replace(/\D/g, '');
  const fullName = body.fullName.trim();
  const inviteCode = body.inviteCode?.trim();

  if (!email || !password || !fullName) {
    throw new Error('Email, password and full name are required');
  }

  if (phone.length < 10 || phone.length > 11) {
    throw new Error('Invalid phone number');
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'patient', phone },
    });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'Failed to create patient account');
  }

  const patientId = authData.user.id;

  const { error: profileError } = await admin
    .from('profiles')
    .update(
      toSnakeRecord({
        fullName,
        phone,
        language: body.language ?? 'pt',
        updatedAt: new Date().toISOString(),
      })
    )
    .eq('id', patientId);

  if (profileError) {
    await admin.auth.admin.deleteUser(patientId);
    throw new Error(
      `Failed to update patient profile: ${profileError.message}`
    );
  }

  try {
    if (inviteCode) {
      const psychologistId = await resolvePsychologistIdByInviteCode(
        admin,
        inviteCode
      );
      await linkPatientToPsychologist(admin, psychologistId, patientId);
    } else {
      await ensurePatientClinicalContent(admin, patientId);
    }
  } catch (error) {
    await admin.auth.admin.deleteUser(patientId);
    throw error;
  }
};

export const linkPatientWithInviteCode = async (
  admin: SupabaseClient,
  patientId: string,
  inviteCode: string
): Promise<void> => {
  const psychologistId = await resolvePsychologistIdByInviteCode(
    admin,
    inviteCode
  );
  await linkPatientToPsychologist(admin, psychologistId, patientId);
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
    throw new Error(authError?.message ?? 'Failed to create patient auth user');
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
    throw new Error(
      `Failed to update patient profile: ${profileError.message}`
    );
  }

  await linkPatientToPsychologist(admin, psychologistId, patientId);

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

export const updatePatientLastConsultationAt = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string,
  lastConsultationAt: string
): Promise<void> => {
  const { error } = await admin
    .from('care_relationships')
    .update(toSnakeRecord({ lastConsultationAt }))
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .eq('is_deleted', false);

  if (error) {
    throw new Error(
      `Failed to update last consultation: ${error.message}`
    );
  }
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

export const restorePatientForPsychologist = async (
  admin: SupabaseClient,
  psychologistId: string,
  patientId: string
): Promise<PsychologistPatientListItem> => {
  const existing = await getPatientForPsychologist(
    admin,
    psychologistId,
    patientId,
    { includeDeleted: true }
  );

  if (!existing) {
    throw new NotFoundError('Patient not found');
  }

  if (!existing.isDeleted) {
    return existing;
  }

  await linkPatientToPsychologist(admin, psychologistId, patientId);

  const restored = await getPatientForPsychologist(
    admin,
    psychologistId,
    patientId
  );

  if (!restored) {
    throw new Error('Patient restored but could not be loaded');
  }

  return restored;
};
