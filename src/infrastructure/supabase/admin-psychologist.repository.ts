import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminPsychologistListItem } from '@domain/admin.types.js';

type PsychologistProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type CareRelationshipCountRow = {
  psychologist_id: string;
  is_deleted: boolean;
};

export const listPsychologistsForAdmin = async (
  admin: SupabaseClient
): Promise<AdminPsychologistListItem[]> => {
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('role', 'psychologist')
    .eq('is_admin', false)
    .order('full_name', { ascending: true });

  if (profilesError) {
    throw new Error(
      `Failed to list psychologists for admin: ${profilesError.message}`
    );
  }

  const psychologistRows = (profiles ?? []) as PsychologistProfileRow[];
  if (!psychologistRows.length) {
    return [];
  }

  const psychologistIds = psychologistRows.map((row) => row.id);
  const { data: relationships, error: relationshipsError } = await admin
    .from('care_relationships')
    .select('psychologist_id, is_deleted')
    .in('psychologist_id', psychologistIds);

  if (relationshipsError) {
    throw new Error(
      `Failed to count psychologist patients: ${relationshipsError.message}`
    );
  }

  const countsByPsychologist = new Map<
    string,
    { active: number; total: number }
  >();

  for (const row of (relationships ?? []) as CareRelationshipCountRow[]) {
    const psychologistId = row.psychologist_id;
    const isDeleted = row.is_deleted;
    const current = countsByPsychologist.get(psychologistId) ?? {
      active: 0,
      total: 0,
    };
    current.total += 1;
    if (!isDeleted) {
      current.active += 1;
    }
    countsByPsychologist.set(psychologistId, current);
  }

  return psychologistRows.map((row) => {
    const counts = countsByPsychologist.get(row.id) ?? { active: 0, total: 0 };
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      activePatientCount: counts.active,
      totalPatientCount: counts.total,
    };
  });
};

export const assertPsychologistProfileForAdmin = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<void> => {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('id', psychologistId)
    .eq('role', 'psychologist')
    .eq('is_admin', false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify psychologist profile: ${error.message}`);
  }

  if (!data) {
    throw new Error('Psychologist not found');
  }
};
