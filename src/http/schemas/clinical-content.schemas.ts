import Joi from 'joi';

export const updateClinicalSessionBodySchema = Joi.object({
  sessionContext: Joi.string().allow('', null).optional(),
  currentSessionNoteContent: Joi.string().allow('', null).optional(),
})
  .or('sessionContext', 'currentSessionNoteContent')
  .messages({
    'object.missing': 'Informe sessionContext ou currentSessionNoteContent',
  });
