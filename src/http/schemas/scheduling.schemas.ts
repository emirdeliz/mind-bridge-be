import Joi from 'joi';

const timeSchema = Joi.string().trim().pattern(/^\d{2}:\d{2}$/);

export const schedulingWeekQuerySchema = Joi.object({
  weekStart: Joi.string().isoDate().required(),
  tzOffset: Joi.number().integer().required(),
}).unknown(false);

export const updateSchedulingSettingsBodySchema = Joi.object({
  sessionDurationMinutes: Joi.number().integer().min(1).required(),
  dayStartTime: timeSchema.required(),
  dayEndTime: timeSchema.required(),
  breakIntervals: Joi.array()
    .items(
      Joi.object({
        startTime: timeSchema.required(),
        endTime: timeSchema.required(),
      }).unknown(false)
    )
    .required(),
  confirmRemoveConflicts: Joi.boolean().optional(),
  tzOffset: Joi.number().integer().required(),
}).unknown(false);

export const createAppointmentBodySchema = Joi.object({
  startsAt: Joi.string().isoDate().required(),
  weekStart: Joi.string().isoDate().required(),
  tzOffset: Joi.number().integer().required(),
  isPersonalCommitment: Joi.boolean().optional().default(false),
  patientId: Joi.when('isPersonalCommitment', {
    is: true,
    then: Joi.forbidden(),
    otherwise: Joi.string().uuid().required(),
  }),
  durationMinutes: Joi.when('isPersonalCommitment', {
    is: true,
    then: Joi.forbidden(),
    otherwise: Joi.number().integer().min(1).optional(),
  }),
  notes: Joi.when('isPersonalCommitment', {
    is: true,
    then: Joi.forbidden(),
    otherwise: Joi.string().trim().max(2000).optional().allow('', null),
  }),
  endTime: Joi.when('isPersonalCommitment', {
    is: true,
    then: timeSchema.required(),
    otherwise: Joi.forbidden(),
  }),
  personalDescription: Joi.when('isPersonalCommitment', {
    is: true,
    then: Joi.string().trim().min(1).max(2000).required(),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);

export const moveAppointmentBodySchema = Joi.object({
  startsAt: Joi.string().isoDate().required(),
  weekStart: Joi.string().isoDate().required(),
  tzOffset: Joi.number().integer().required(),
}).unknown(false);

export const appointmentIdParamsSchema = Joi.object({
  appointmentId: Joi.string().uuid().required(),
}).unknown(false);
