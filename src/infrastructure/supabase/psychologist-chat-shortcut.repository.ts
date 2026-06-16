import type { SupabaseClient } from '@supabase/supabase-js';

import { NotFoundError } from '@application/authorization.js';
import { DEFAULT_PSYCHOLOGIST_CHAT_SHORTCUTS } from '@domain/default-psychologist-chat-shortcuts.js';
import type {
  ChatShortcutTranslations,
  PsychologistChatShortcut,
} from '@domain/psychologist-chat-shortcut.types.js';
import { keysToCamel } from '@helpers';

type ChatShortcutRow = {
  id: string;
  psychologistId: string;
  sortOrder: number;
  translations: ChatShortcutTranslations;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: Record<string, unknown>): PsychologistChatShortcut =>
  keysToCamel<ChatShortcutRow>(row);

export const listPsychologistChatShortcuts = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistChatShortcut[]> => {
  const { data, error } = await admin
    .from('psychologist_chat_shortcuts')
    .select(
      'id, psychologist_id, sort_order, translations, created_at, updated_at'
    )
    .eq('psychologist_id', psychologistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list chat shortcuts: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
};

export const ensureDefaultPsychologistChatShortcuts = async (
  admin: SupabaseClient,
  psychologistId: string
): Promise<PsychologistChatShortcut[]> => {
  const existing = await listPsychologistChatShortcuts(admin, psychologistId);
  if (existing.length > 0) {
    return existing;
  }

  const now = new Date().toISOString();
  const rows = DEFAULT_PSYCHOLOGIST_CHAT_SHORTCUTS.map((shortcut) => ({
    psychologist_id: psychologistId,
    sort_order: shortcut.sortOrder,
    translations: shortcut.translations,
    created_at: now,
    updated_at: now,
  }));

  const { data, error } = await admin
    .from('psychologist_chat_shortcuts')
    .insert(rows)
    .select(
      'id, psychologist_id, sort_order, translations, created_at, updated_at'
    );

  if (error) {
    throw new Error(`Failed to seed default chat shortcuts: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
};

export const seedDefaultPsychologistChatShortcutsForAllPsychologists = async (
  admin: SupabaseClient
): Promise<number> => {
  const { data: psychologists, error } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'psychologist');

  if (error) {
    throw new Error(
      `Failed to list psychologists for chat shortcut seed: ${error.message}`
    );
  }

  let seededCount = 0;
  for (const psychologist of psychologists ?? []) {
    const before = await listPsychologistChatShortcuts(
      admin,
      psychologist.id as string
    );
    if (before.length > 0) {
      continue;
    }
    await ensureDefaultPsychologistChatShortcuts(
      admin,
      psychologist.id as string
    );
    seededCount += 1;
  }

  return seededCount;
};

export const createPsychologistChatShortcut = async (
  admin: SupabaseClient,
  psychologistId: string,
  translations: ChatShortcutTranslations
): Promise<PsychologistChatShortcut> => {
  const { data: lastRows, error: lastError } = await admin
    .from('psychologist_chat_shortcuts')
    .select('sort_order')
    .eq('psychologist_id', psychologistId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (lastError) {
    throw new Error(
      `Failed to resolve chat shortcut order: ${lastError.message}`
    );
  }

  const nextSortOrder =
    ((lastRows?.[0]?.sort_order as number | undefined) ?? -1) + 1;
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('psychologist_chat_shortcuts')
    .insert({
      psychologist_id: psychologistId,
      sort_order: nextSortOrder,
      translations,
      created_at: now,
      updated_at: now,
    })
    .select(
      'id, psychologist_id, sort_order, translations, created_at, updated_at'
    )
    .single();

  if (error) {
    throw new Error(`Failed to create chat shortcut: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
};

export const updatePsychologistChatShortcut = async (
  admin: SupabaseClient,
  psychologistId: string,
  shortcutId: string,
  translations: ChatShortcutTranslations
): Promise<PsychologistChatShortcut> => {
  const { data, error } = await admin
    .from('psychologist_chat_shortcuts')
    .update({
      translations,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shortcutId)
    .eq('psychologist_id', psychologistId)
    .select(
      'id, psychologist_id, sort_order, translations, created_at, updated_at'
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update chat shortcut: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('Chat shortcut not found');
  }

  return mapRow(data as Record<string, unknown>);
};

export const deletePsychologistChatShortcut = async (
  admin: SupabaseClient,
  psychologistId: string,
  shortcutId: string
): Promise<void> => {
  const { data, error } = await admin
    .from('psychologist_chat_shortcuts')
    .delete()
    .eq('id', shortcutId)
    .eq('psychologist_id', psychologistId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete chat shortcut: ${error.message}`);
  }

  if (!data) {
    throw new NotFoundError('Chat shortcut not found');
  }
};
