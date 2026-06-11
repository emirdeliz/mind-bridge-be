import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PsychologistAppointment,
  PsychologistSchedulingSettings,
  SchedulingBreakInterval,
} from '@domain/scheduling.types.js';
import { keysToCamel, toSnakeRecord } from '@helpers';

const DEFAULT_SETTINGS: Omit<PsychologistSchedulingSettings, 'psychologistId' | 'updatedAt'> = {
  sessionDurationMinutes: 50,
  dayStartTime: '08:00:00',
  dayEndTime: '20:00:00',
  breakIntervals: [{ startTime: '12:00', endTime: '13:00' }],
};

const normalizeTime = (value: string): string => value.slice(0, 5);

const mapSettings = (
  psychologistId: string,
  row: Record<string, unknown>
): PsychologistSchedulingSettings => {
  const record = keysToCamel<{
    sessionDurationMinutes: number;
    dayStartTime: string;
    dayEndTime: string;
    breakIntervals: SchedulingBreakInterval[];
    updatedAt: string;
  }>(row);

  return {
    psychologistId,
    sessionDurationMinutes: record.sessionDurationMinutes,
    dayStartTime: normalizeTime(record.dayStartTime),
    dayEndTime: normalizeTime(record.dayEndTime),
    breakIntervals: (record.breakIntervals ?? []).map((interval) => ({
      startTime: normalizeTime(interval.startTime),
      endTime: normalizeTime(interval.endTime),
    })),
    updatedAt: record.updatedAt,
  };
};

const mapAppointment = (row: unknown): PsychologistAppointment => {
  const record = keysToCamel<{
    id: string;
    psychologistId: string;
    patientId: string | null;
    startsAt: string;
    durationMinutes: number;
    notes: string | null;
    isPersonalCommitment: boolean;
    patient: { fullName: string | null; email: string | null } | null;
  }>(row);

  return {
    id: record.id,
    psychologistId: record.psychologistId,
    patientId: record.patientId ?? null,
    patientFullName: record.patient?.fullName ?? null,
    patientEmail: record.patient?.email ?? null,
    startsAt: record.startsAt,
    durationMinutes: record.durationMinutes,
    notes: record.notes ?? null,
    isPersonalCommitment: record.isPersonalCommitment ?? false,
  };
};

export const getSchedulingSettings = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistSchedulingSettings> => {
  const { data, error } = await admin
    .from('psychologist_scheduling_settings')
    .select(
      'session_duration_minutes, day_start_time, day_end_time, break_intervals, updated_at'
    )
    .eq('psychologist_id', psychologistId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load scheduling settings: ${error.message}`);
  }

  if (!data) {
    return {
      psychologistId,
      sessionDurationMinutes: DEFAULT_SETTINGS.sessionDurationMinutes,
      dayStartTime: normalizeTime(DEFAULT_SETTINGS.dayStartTime),
      dayEndTime: normalizeTime(DEFAULT_SETTINGS.dayEndTime),
      breakIntervals: DEFAULT_SETTINGS.breakIntervals,
      updatedAt: new Date().toISOString(),
    };
  }

  return mapSettings(psychologistId, data);
};

export const upsertSchedulingSettings = async (
  admin: SupabaseClient,
  psychologistId: string,
  settings: {
    sessionDurationMinutes: number;
    dayStartTime: string;
    dayEndTime: string;
    breakIntervals: SchedulingBreakInterval[];
  }
): Promise<PsychologistSchedulingSettings> => {
  const { data, error } = await admin
    .from('psychologist_scheduling_settings')
    .upsert(
      toSnakeRecord({
        psychologistId,
        sessionDurationMinutes: settings.sessionDurationMinutes,
        dayStartTime: settings.dayStartTime,
        dayEndTime: settings.dayEndTime,
        breakIntervals: settings.breakIntervals,
        updatedAt: new Date().toISOString(),
      }),
      { onConflict: 'psychologist_id' }
    )
    .select(
      'session_duration_minutes, day_start_time, day_end_time, break_intervals, updated_at'
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save scheduling settings');
  }

  return mapSettings(psychologistId, data);
};

const appointmentSelect = `
  id,
  psychologist_id,
  patient_id,
  starts_at,
  duration_minutes,
  notes,
  is_personal_commitment,
  patient:profiles!patient_id (
    full_name,
    email
  )
`;

export const getAppointmentById = async (
  admin: SupabaseClient,
  psychologistId: string,
  appointmentId: string
): Promise<PsychologistAppointment | null> => {
  const { data, error } = await admin
    .from('psychologist_appointments')
    .select(appointmentSelect)
    .eq('id', appointmentId)
    .eq('psychologist_id', psychologistId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load appointment: ${error.message}`);
  }

  return data ? mapAppointment(data) : null;
};

export const listAppointmentsBetween = async (
  admin: SupabaseClient,
  psychologistId: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<PsychologistAppointment[]> => {
  const { data, error } = await admin
    .from('psychologist_appointments')
    .select(appointmentSelect)
    .eq('psychologist_id', psychologistId)
    .gte('starts_at', rangeStartIso)
    .lt('starts_at', rangeEndIso)
    .order('starts_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list appointments: ${error.message}`);
  }

  return (data ?? []).map(mapAppointment);
};

export const createAppointment = async (
  admin: SupabaseClient,
  input: {
    psychologistId: string;
    patientId?: string | null;
    startsAt: string;
    durationMinutes: number;
    notes?: string | null;
    isPersonalCommitment?: boolean;
  }
): Promise<PsychologistAppointment> => {
  const { data, error } = await admin
    .from('psychologist_appointments')
    .insert(
      toSnakeRecord({
        psychologistId: input.psychologistId,
        patientId: input.isPersonalCommitment ? null : input.patientId,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        notes: input.notes?.trim() || null,
        isPersonalCommitment: input.isPersonalCommitment ?? false,
        updatedAt: new Date().toISOString(),
      })
    )
    .select(appointmentSelect)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create appointment');
  }

  return mapAppointment(data);
};

export const updateAppointmentStart = async (
  admin: SupabaseClient,
  psychologistId: string,
  appointmentId: string,
  startsAt: string
): Promise<PsychologistAppointment> => {
  const { data, error } = await admin
    .from('psychologist_appointments')
    .update(
      toSnakeRecord({
        startsAt,
        updatedAt: new Date().toISOString(),
      })
    )
    .eq('id', appointmentId)
    .eq('psychologist_id', psychologistId)
    .select(appointmentSelect)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update appointment');
  }

  return mapAppointment(data);
};

export const deleteAppointmentsByIds = async (
  admin: SupabaseClient,
  psychologistId: string,
  appointmentIds: string[]
): Promise<void> => {
  if (!appointmentIds.length) {
    return;
  }

  const { error } = await admin
    .from('psychologist_appointments')
    .delete()
    .eq('psychologist_id', psychologistId)
    .in('id', appointmentIds);

  if (error) {
    throw new Error(`Failed to delete appointments: ${error.message}`);
  }
};

export const deleteAppointment = async (
  admin: SupabaseClient,
  psychologistId: string,
  appointmentId: string
): Promise<void> => {
  await deleteAppointmentsByIds(admin, psychologistId, [appointmentId]);
};
