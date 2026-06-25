import Joi from 'joi';

export const getAdminPlatformMetricsQuerySchema = Joi.object({
  period: Joi.string().valid('month', '3m', '6m', '1y').optional(),
});

export const adminPsychologistIdParamsSchema = Joi.object({
  psychologistId: Joi.string().uuid().required(),
});

export const getAdminPsychologistPatientsQuerySchema = Joi.object({
  name: Joi.string().trim().max(120).optional(),
  includeDeleted: Joi.boolean().optional(),
  interactionPeriod: Joi.string()
    .valid('week', 'month', '3m', '6m', '1y')
    .optional(),
});

export const getAdminPsychologistBillingQuerySchema = Joi.object({
  month: Joi.string()
    .pattern(/^\d{4}-\d{2}-01$/)
    .optional(),
});
