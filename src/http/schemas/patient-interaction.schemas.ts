import Joi from 'joi';

export const logMoodDiaryBodySchema = Joi.object({
  moodScore: Joi.number().integer().min(1).max(10).required(),
  source: Joi.string().valid('web', 'app').optional(),
});

export const logPatientInteractionBodySchema = Joi.object({
  channel: Joi.string()
    .valid('text', 'audio', 'notification', 'mood_diary')
    .required(),
  source: Joi.string().valid('web', 'app').optional(),
  moodScore: Joi.when('channel', {
    is: 'mood_diary',
    then: Joi.number().integer().min(1).max(10).required(),
    otherwise: Joi.number().integer().min(1).max(10).optional(),
  }),
});
