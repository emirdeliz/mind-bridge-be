/** Patient emails seeded and linked to Aluizio Vilar in scripts/seed-local-dev.mjs */

export const ALUIZIO_PSYCHOLOGIST_EMAIL = 'aluizio.vilar@gmail.com';

/** Patients created only for Aluizio — safe to delete entirely. */
export const ALUIZIO_ONLY_SEED_PATIENT_EMAILS = [
  'maurosouza@gmail.com',
  'carlosamaro@gmail.com',
];

/** Demo patients also linked to Emir — unlink from Aluizio only. */
export const ALUIZIO_SHARED_SEED_PATIENT_EMAILS = [
  'ana.demo@mindbridge.local',
  'bruno.demo@mindbridge.local',
  'carla.demo@mindbridge.local',
  'diego.demo@mindbridge.local',
  'elisa.demo@mindbridge.local',
];

export const ALUIZIO_SEED_PATIENT_EMAILS = [
  ...ALUIZIO_ONLY_SEED_PATIENT_EMAILS,
  ...ALUIZIO_SHARED_SEED_PATIENT_EMAILS,
].sort();
