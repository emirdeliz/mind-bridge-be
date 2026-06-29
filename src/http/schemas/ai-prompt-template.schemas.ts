import Joi from 'joi';

export const aiPromptTemplateKeyParamsSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z0-9_.]+$/)
    .required(),
});

export const saveAiPromptTemplateBodySchema = Joi.object({
  content: Joi.string().trim().min(1).required(),
  sourceLanguage: Joi.string().valid('pt', 'en', 'es').required(),
});

export const testAiPromptTemplateBodySchema = Joi.object({
  content: Joi.string().trim().min(1).required(),
  sourceLanguage: Joi.string().valid('pt', 'en', 'es').required(),
  testMessage: Joi.string().trim().min(1).max(4000).required(),
  psychologistContext: Joi.string().trim().max(8000).allow('').optional(),
  sessionConsiderations: Joi.string().trim().max(8000).allow('').optional(),
  clinicalContext: Joi.string().trim().max(8000).allow('').optional(),
});

export const testPsychologistPromptTemplateBodySchema =
  testAiPromptTemplateBodySchema;
