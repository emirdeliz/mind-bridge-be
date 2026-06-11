export type PatientSessionPayment = {
  id: string;
  psychologistId: string;
  patientId: string;
  billingMonth: string;
  amountCents: number;
  paidAt: string;
  notes: string | null;
};

export type PatientPaymentRow = {
  patientId: string;
  fullName: string | null;
  email: string | null;
  isCompliant: boolean;
  isBillableInSelectedMonth: boolean;
  unpaidBillingMonths: string[];
  payment: PatientSessionPayment | null;
};

export type PsychologistPatientPaymentsSummary = {
  billingMonth: string;
  isCurrentMonth: boolean;
  currency: string;
  totalCollectedCents: number;
  compliantCount: number;
  nonCompliantCount: number;
  expectedPatientCount: number;
  patients: PatientPaymentRow[];
  availableMonths: string[];
};
