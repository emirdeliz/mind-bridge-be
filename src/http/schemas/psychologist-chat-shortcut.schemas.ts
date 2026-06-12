import Joi from 'joi';

export const chatShortcutIdParamsSchema = Joi.object({
  shortcutId: Joi.string().uuid().required(),
});

export const saveChatShortcutBodySchema = Joi.object({
  label: Joi.string().trim().min(1).max(120).required(),
  message: Joi.string().trim().min(1).max(2000).required(),
  sourceLanguage: Joi.string().valid('en', 'es', 'pt').required(),
});
