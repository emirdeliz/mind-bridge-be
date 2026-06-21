/** Patient emails created or used by scripts/seed-local-dev.mjs */

import { DEMO_CLINICAL_BY_EMAIL } from './demo-clinical-data.mjs';

const CORE_DEMO_PATIENTS = [
  'ana.demo@mindbridge.local',
  'bruno.demo@mindbridge.local',
  'carla.demo@mindbridge.local',
  'diego.demo@mindbridge.local',
  'elisa.demo@mindbridge.local',
  'josecarlos@gmail.com',
  'maurosouza@gmail.com',
  'carlosamaro@gmail.com',
];

/** Patient kept when pruning other seed/demo accounts */
export const KEEP_SEED_PATIENT_EMAIL = 'maurosouza@gmail.com';

const buildExtraDemoPatientEmails = () => {
  const emails = [];
  for (let psychologistIndex = 0; psychologistIndex < 7; psychologistIndex += 1) {
    const patientCount = 2 + (psychologistIndex % 4);
    for (let patientIndex = 0; patientIndex < patientCount; patientIndex += 1) {
      emails.push(
        `p${String(psychologistIndex + 1).padStart(2, '0')}${String(patientIndex + 1).padStart(2, '0')}@mindbridge.local`
      );
    }
  }
  return emails;
};

export const SEED_PATIENT_EMAILS = [
  ...new Set([
    ...CORE_DEMO_PATIENTS,
    ...Object.keys(DEMO_CLINICAL_BY_EMAIL),
    'carlosamaro@gmail.com',
    ...buildExtraDemoPatientEmails(),
  ]),
].sort();
