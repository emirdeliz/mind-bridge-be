import Joi from 'joi';

export const getAdminPlatformMetricsQuerySchema = Joi.object({
  period: Joi.string().valid('month', '3m', '6m', '1y').optional(),
});
