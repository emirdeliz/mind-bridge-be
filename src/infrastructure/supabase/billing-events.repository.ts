import type { SupabaseClient } from '@supabase/supabase-js';

import { toSnakeRecord } from '@helpers';

export type CareBillingEventType = 'enabled' | 'disabled';

export const recordCareBillingEvent = async (
  admin: SupabaseClient,
  payload: {
    careRelationshipId: string;
    psychologistId: string;
    patientId: string;
    eventType: CareBillingEventType;
    occurredAt?: string;
  }
): Promise<void> => {
  const { error } = await admin
    .from('care_relationship_billing_events')
    .insert(
      toSnakeRecord({
        careRelationshipId: payload.careRelationshipId,
        psychologistId: payload.psychologistId,
        patientId: payload.patientId,
        eventType: payload.eventType,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
      })
    );

  if (error) {
    throw new Error(`Failed to record billing event: ${error.message}`);
  }
};
