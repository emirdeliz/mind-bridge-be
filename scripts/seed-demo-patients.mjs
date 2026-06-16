#!/usr/bin/env node
/**
 * Creates demo patients linked to the first psychologist profile.
 * Usage (from mind-bridge-be): node scripts/seed-demo-patients.mjs
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (loaded via dotenv not included — export vars or use shell).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PATIENTS = [
  {
    fullName: 'Ana M.',
    email: 'ana.demo@mindbridge.local',
    phone: '11987654321',
    password: 'demo123456',
    lastConsultationAt: '2026-05-28T14:00:00.000Z',
  },
  {
    fullName: 'Bruno Costa',
    email: 'bruno.demo@mindbridge.local',
    phone: '11976543210',
    password: 'demo123456',
    lastConsultationAt: '2026-05-20T10:30:00.000Z',
  },
  {
    fullName: 'Carla Mendes',
    email: 'carla.demo@mindbridge.local',
    phone: '21999887766',
    password: 'demo123456',
    lastConsultationAt: '2026-04-15T16:00:00.000Z',
  },
  {
    fullName: 'Diego Ribeiro',
    email: 'diego.demo@mindbridge.local',
    phone: '31988776655',
    password: 'demo123456',
    lastConsultationAt: null,
  },
];

const main = async () => {
  const { data: psychologists, error: psychError } = await admin
    .from('profiles')
    .select('id, email')
    .eq('role', 'psychologist')
    .limit(1);

  if (psychError || !psychologists?.length) {
    console.error(
      'No psychologist profile found. Register a user with role psychologist first.'
    );
    process.exit(1);
  }

  const psychologistId = psychologists[0].id;
  console.log(
    `Using psychologist ${psychologists[0].email} (${psychologistId})`
  );

  for (const demo of DEMO_PATIENTS) {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', demo.email)
      .maybeSingle();

    let patientId = existingProfile?.id;

    if (!patientId) {
      const { data: authData, error: authError } =
        await admin.auth.admin.createUser({
          email: demo.email,
          password: demo.password,
          email_confirm: true,
          user_metadata: { role: 'patient' },
        });

      if (authError) {
        console.warn(`Skip ${demo.email}: ${authError.message}`);
        continue;
      }

      patientId = authData.user.id;

      await admin
        .from('profiles')
        .update({
          full_name: demo.fullName,
          phone: demo.phone,
          language: 'pt',
        })
        .eq('id', patientId);
    }

    const { data: existingCare } = await admin
      .from('care_relationships')
      .select('id')
      .eq('psychologist_id', psychologistId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (!existingCare) {
      const { error: careError } = await admin
        .from('care_relationships')
        .insert({
          psychologist_id: psychologistId,
          patient_id: patientId,
          status: 'active',
          is_deleted: false,
          last_consultation_at: demo.lastConsultationAt,
        });

      if (careError) {
        console.warn(`Care link ${demo.email}: ${careError.message}`);
        continue;
      }
    } else {
      await admin
        .from('care_relationships')
        .update({
          is_deleted: false,
          last_consultation_at: demo.lastConsultationAt,
        })
        .eq('id', existingCare.id);
    }

    console.log(`OK: ${demo.fullName} (${demo.email})`);
  }

  console.log('Done.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
