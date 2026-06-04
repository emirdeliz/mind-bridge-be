import Joi from 'joi';

export const listPatientsQuerySchema = Joi.object({
  name: Joi.string().trim().allow('').optional(),
  includeDeleted: Joi.boolean().truthy('true').falsy('false').optional(),
});

export const patientIdParamsSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
});

export const savePatientBodySchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(200).required(),
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
  email: Joi.string().email().optional(),
  password: Joi.string().min(5).optional(),
  age: Joi.string().trim().allow('', null).optional(),
  address: Joi.string().trim().allow('', null).optional(),
  language: Joi.string().valid('en', 'es', 'pt').optional(),
});

export const createPatientBodySchema = savePatientBodySchema.keys({
  email: Joi.string().email().required(),
  password: Joi.string().length(5).pattern(/^[A-Za-z0-9]{5}$/).required(),
});
