import { randomBytes } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { keysToCamel } from '@helpers';

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;

const generateInviteCode = (): string => {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[bytes[index]! % INVITE_CODE_ALPHABET.length];
  }

  return code;
};

const normalizeInviteCode = (code: string): string =>
  code.trim().toUpperCase().replace(/\s+/g, '');

type InviteCodeRow = {
  psychologistId: string;
  code: string;
};

export class InvalidInviteCodeError extends Error {
  constructor(message = 'Código de convite inválido') {
    super(message);
    this.name = 'InvalidInviteCodeError';
  }
}

export const resolvePsychologistIdByInviteCode = async (
  admin: SupabaseClient,
  rawCode: string
): Promise<string> => {
  const code = normalizeInviteCode(rawCode);

  if (code.length !== INVITE_CODE_LENGTH) {
    throw new InvalidInviteCodeError();
  }

  const { data, error } = await admin
    .from('psychologist_invite_codes')
    .select('psychologist_id, code')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve invite code: ${error.message}`);
  }

  if (!data) {
    throw new InvalidInviteCodeError();
  }

  const record = keysToCamel<InviteCodeRow>(data);
  return record.psychologistId;
};

export const getOrCreatePsychologistInviteCode = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<string> => {
  const { data: existing, error: readError } = await admin
    .from('psychologist_invite_codes')
    .select('code')
    .eq('psychologist_id', psychologistId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to load invite code: ${readError.message}`);
  }

  if (existing?.code) {
    return existing.code as string;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { error: insertError } = await admin
      .from('psychologist_invite_codes')
      .insert({
        psychologist_id: psychologistId,
        code,
        updated_at: new Date().toISOString(),
      });

    if (!insertError) {
      return code;
    }

    if (insertError.code !== '23505') {
      throw new Error(`Failed to create invite code: ${insertError.message}`);
    }
  }

  throw new Error('Failed to generate a unique invite code');
};

export const regeneratePsychologistInviteCode = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { error } = await admin.from('psychologist_invite_codes').upsert(
      {
        psychologist_id: psychologistId,
        code,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'psychologist_id' }
    );

    if (!error) {
      return code;
    }

    if (error.code !== '23505') {
      throw new Error(`Failed to regenerate invite code: ${error.message}`);
    }
  }

  throw new Error('Failed to generate a unique invite code');
};
