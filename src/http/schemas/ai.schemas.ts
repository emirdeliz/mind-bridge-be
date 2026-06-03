import Joi from 'joi';

export const patientChatBodySchema = Joi.object({
  message: Joi.string().trim().min(1).max(8000).required(),
  careContext: Joi.string().trim().max(16000).optional().allow(''),
}).unknown(false);

export const psychologistChatBodySchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  message: Joi.string().trim().min(1).max(8000).required(),
  clinicalContext: Joi.string().trim().max(16000).optional().allow(''),
}).unknown(false);
