import Joi from 'joi';

const likertScoreSchema = Joi.number().integer().min(1).max(5);

export const updateLikertCheckInBodySchema = Joi.object({
  scores: Joi.object({
    mood: likertScoreSchema.optional(),
    anxiety: likertScoreSchema.optional(),
    sleep: likertScoreSchema.optional(),
    wellbeing: likertScoreSchema.optional(),
  })
    .min(1)
    .required(),
});
