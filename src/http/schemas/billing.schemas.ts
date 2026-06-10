import Joi from 'joi';

export const getBillingQuerySchema = Joi.object({
  month: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-01$/)
    .optional(),
});
