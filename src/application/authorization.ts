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

export const assertPatientSelf = (
  auth: AuthContext,
  patientId: string
): void => {
  if (auth.role !== 'patient' || auth.userId !== patientId) {
    throw new ForbiddenError('Patients may only access their own data');
  }
};

export const assertPsychologistPatientAccess = async (
  client: SupabaseClient,
  auth: AuthContext,
  patientId: string
): Promise<void> => {
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
