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
  patientId: Joi.string().uuid().required(),
  startsAt: Joi.string().isoDate().required(),
  durationMinutes: Joi.number().integer().min(1).optional(),
  notes: Joi.string().trim().max(2000).optional().allow('', null),
  weekStart: Joi.string().isoDate().required(),
  tzOffset: Joi.number().integer().required(),
}).unknown(false);

export const moveAppointmentBodySchema = Joi.object({
  startsAt: Joi.string().isoDate().required(),
  weekStart: Joi.string().isoDate().required(),
  tzOffset: Joi.number().integer().required(),
}).unknown(false);

export const appointmentIdParamsSchema = Joi.object({
  appointmentId: Joi.string().uuid().required(),
}).unknown(false);
