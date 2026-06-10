export const computePsychologistBillingAmounts = (
  billablePatientCount: number,
  unitPriceCents: number,
  discountPercent: number
) => {
  const grossAmountCents = billablePatientCount * unitPriceCents;
  const discountAmountCents = Math.round(
    grossAmountCents * (discountPercent / 100)
  );
  const netAmountCents = grossAmountCents - discountAmountCents;

  return { grossAmountCents, discountAmountCents, netAmountCents };
};
