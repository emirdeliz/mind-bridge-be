import Joi from 'joi';

export const registerPatientBodySchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(5).required(),
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        return helpers.error('any.invalid');
      }
      return value;
    }),
  fullName: Joi.string().trim().min(1).max(200).required(),
  inviteCode: Joi.string().trim().min(4).max(32).allow('', null).optional(),
  language: Joi.string().valid('en', 'es', 'pt').optional(),
});
