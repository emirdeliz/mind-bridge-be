import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthContext } from '@domain/types.js';
import { hasActiveCareRelationship } from '@infrastructure/supabase/profile.repository.js';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const assertAdmin = (auth: AuthContext | undefined): void => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }
  if (!auth.isAdmin) {
    throw new ForbiddenError('Only platform admins may perform this action');
  }
};

export const assertKnowledgeDocumentUploader = (
  auth: AuthContext | undefined,
  allowedRole: 'admin' | 'psychologist'
): void => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }

  if (allowedRole === 'admin') {
    assertAdmin(auth);
    return;
  }

  assertPsychologist(auth);
};

export const assertKnowledgeDocumentReader = (
  auth: AuthContext | undefined
): void => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }

  if (auth.isAdmin || auth.role === 'psychologist') {
    return;
  }

  throw new ForbiddenError(
    'Only psychologists or platform admins may access knowledge documents'
  );
};

export const assertPsychologist = (auth: AuthContext | undefined): void => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }
  if (auth.role !== 'psychologist') {
    throw new ForbiddenError('Only psychologists may perform this action');
  }
};

export const assertPatientSelf = (
  auth: AuthContext | undefined,
  patientId: string
): void => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }
  if (auth.role !== 'patient' || auth.userId !== patientId) {
    throw new ForbiddenError('Patients may only access their own data');
  }
};

export const assertPsychologistPatientAccess = async (
  client: SupabaseClient,
  auth: AuthContext | undefined,
  patientId: string
): Promise<void> => {
  if (!auth) {
    throw new Error('Unauthorized: missing auth context');
  }
  if (auth.role !== 'psychologist') {
    throw new ForbiddenError(
      'Only psychologists may access patient clinical data'
    );
  }

  const allowed = await hasActiveCareRelationship(
    client,
    auth.userId,
    patientId
  );
  if (!allowed) {
    throw new ForbiddenError('No active care relationship with this patient');
  }
};
