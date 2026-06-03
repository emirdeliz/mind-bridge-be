import type { AppLanguage } from '@domain/types.js';

export interface PsychologistPatientListItem {
  id: string;
  fullName: string | null;
  phone: string | null;
  lastConsultationAt: string | null;
  isDeleted: boolean;
}

export interface PsychologistPatientSaveBody {
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  age?: string | null;
  address?: string | null;
  language?: AppLanguage | null;
}
