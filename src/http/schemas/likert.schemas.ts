import Joi from 'joi';

const likertScoreSchema = Joi.number().integer().min(1).max(5);

const localDateKeySchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required()
  .messages({
    'string.pattern.base': 'localDate must be YYYY-MM-DD',
  });

export const updateLikertCheckInBodySchema = Joi.object({
  localDate: localDateKeySchema,
  scores: Joi.object({
    mood: likertScoreSchema.optional(),
    anxiety: likertScoreSchema.optional(),
    sleep: likertScoreSchema.optional(),
    wellbeing: likertScoreSchema.optional(),
  })
    .min(1)
    .required(),
});
