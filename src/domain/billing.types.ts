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

export type PsychologistBillingSummary = {
  enabledPatientCount: number;
  unitPriceCents: number;
  currency: string;
  grossAmountCents: number;
  discount: PsychologistBillingDiscount | null;
  discountAmountCents: number;
  netAmountCents: number;
  history: PsychologistBillingMonthlyEntry[];
};
