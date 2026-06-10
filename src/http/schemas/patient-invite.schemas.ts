import Joi from 'joi';

export const linkPatientInviteCodeBodySchema = Joi.object({
  inviteCode: Joi.string().trim().min(4).max(32).required(),
});
