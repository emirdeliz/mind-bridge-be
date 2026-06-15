import Joi from 'joi';

export const knowledgeDocumentParamsSchema = Joi.object({
  documentId: Joi.string().uuid().required(),
});
