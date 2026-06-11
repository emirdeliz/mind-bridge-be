import Joi from 'joi';

const billingMonthSchema = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-01$/);

export const getPatientPaymentsQuerySchema = Joi.object({
  month: billingMonthSchema.optional(),
}).unknown(false);

export const upsertPatientPaymentBodySchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  billingMonth: billingMonthSchema.required(),
  amountCents: Joi.number().integer().min(1).required(),
  paidAt: Joi.string().isoDate().optional(),
  notes: Joi.string().trim().max(500).optional().allow('', null),
}).unknown(false);

export const patientPaymentIdParamsSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
}).unknown(false);
