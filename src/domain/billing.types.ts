export type BillingPlatformPricing = {
  pricePerPatientCents: number;
  currency: string;
};

export type PsychologistBillingDiscount = {
  discountPercent: number;
  label: string | null;
};

export type PsychologistBillingMonthlyEntry = {
  billingMonth: string;
  enabledPatientCount: number;
  unitPriceCents: number;
  grossAmountCents: number;
  discountPercent: number;
  discountAmountCents: number;
  netAmountCents: number;
};

export type PsychologistBillablePatient = {
  patientId: string;
  fullName: string | null;
  email: string | null;
  enabledAt: string;
  disabledAt: string | null;
  deactivatedDuringMonth: boolean;
  isCurrentlyEnabled: boolean;
};

export type PsychologistBillingSummary = {
  billingMonth: string;
  isCurrentMonth: boolean;
  /** Billable patients for the selected month (patient-month rule). */
  enabledPatientCount: number;
  /** Patients currently active and not soft-deleted (current month only). */
  currentlyEnabledPatientCount: number;
  unitPriceCents: number;
  currency: string;
  grossAmountCents: number;
  discount: PsychologistBillingDiscount | null;
  discountPercent: number;
  discountAmountCents: number;
  netAmountCents: number;
  billablePatients: PsychologistBillablePatient[];
  history: PsychologistBillingMonthlyEntry[];
};
