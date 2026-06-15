import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserProfile } from '@domain/types.js';
import { keysToCamel } from '@helpers';

export const getProfileByUserId = async (
  client: SupabaseClient,
  userId: string
): Promise<UserProfile | null> => {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data ? keysToCamel<UserProfile>(data) : null;
};

export const hasActiveCareRelationship = async (
  client: SupabaseClient,
  psychologistId: string,
  patientId: string
): Promise<boolean> => {
  const { data, error } = await client
    .from('care_relationships')
    .select('id')
    .eq('psychologist_id', psychologistId)
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify care relationship: ${error.message}`);
  }

  return Boolean(data);
};

export const listActivePsychologistIdsForPatient = async (
  client: SupabaseClient,
  patientId: string
): Promise<string[]> => {
  const { data, error } = await client
    .from('care_relationships')
    .select('psychologist_id')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .eq('is_deleted', false);

  if (error) {
    throw new Error(`Failed to list patient psychologists: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.psychologist_id as string)
    .filter(Boolean);
};
