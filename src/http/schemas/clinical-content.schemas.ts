import Joi from 'joi';

export const updateClinicalSessionBodySchema = Joi.object({
  sessionContext: Joi.string().allow('', null).optional(),
  currentSessionNoteContent: Joi.string().allow('', null).optional(),
  language: Joi.string().valid('pt', 'en', 'es').optional(),
})
  .or('sessionContext', 'currentSessionNoteContent')
  .messages({
    'object.missing': 'Informe sessionContext ou currentSessionNoteContent',
  });

export const endPsychologistSessionBodySchema = Joi.object({
  currentSessionNoteContent: Joi.string().allow('', null).optional(),
  language: Joi.string().valid('pt', 'en', 'es').optional(),
});
