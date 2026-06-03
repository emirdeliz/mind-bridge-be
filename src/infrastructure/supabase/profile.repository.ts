import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppLanguage, UserProfile, UserRole } from "../../domain/types.js";

type ProfileRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  age: string | null;
  address: string | null;
  phone: string | null;
  language: AppLanguage | null;
};

const mapRow = (row: ProfileRow): UserProfile => ({
  id: row.id,
  email: row.email,
  role: row.role,
  fullName: row.full_name,
  age: row.age,
  address: row.address,
  phone: row.phone,
  language: row.language,
});

export const getProfileByUserId = async (
  client: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> => {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data ? mapRow(data as ProfileRow) : null;
};

export const hasActiveCareRelationship = async (
  client: SupabaseClient,
  psychologistId: string,
  patientId: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from("care_relationships")
    .select("id")
    .eq("psychologist_id", psychologistId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify care relationship: ${error.message}`);
  }

  return Boolean(data);
};
