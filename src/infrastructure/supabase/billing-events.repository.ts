import type { SupabaseClient } from '@supabase/supabase-js';

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
  const { error } = await admin.from('care_relationship_billing_events').insert({
    care_relationship_id: payload.careRelationshipId,
    psychologist_id: payload.psychologistId,
    patient_id: payload.patientId,
    event_type: payload.eventType,
    occurred_at: payload.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to record billing event: ${error.message}`);
  }
};
