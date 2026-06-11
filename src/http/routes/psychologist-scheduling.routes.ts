import type { FastifyPluginAsync } from 'fastify';

import { assertPsychologist, NotFoundError } from '@application/authorization.js';
import { BadRequestError } from '@http/errors.js';
import { getPsychologistSchedulingWeek } from '@application/get-psychologist-scheduling.js';
import { movePsychologistAppointment } from '@application/move-psychologist-appointment.js';
import { updatePsychologistSchedulingSettings } from '@application/update-psychologist-scheduling-settings.js';
import type { Env } from '@config/env.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@http/middleware/validate.js';
import {
  appointmentIdParamsSchema,
  createAppointmentBodySchema,
  moveAppointmentBodySchema,
  schedulingWeekQuerySchema,
  updatePersonalCommitmentBodySchema,
  updateSchedulingSettingsBodySchema,
} from '@http/schemas/scheduling.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import { getPatientForPsychologist } from '@infrastructure/supabase/patient.repository.js';
import {
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getSchedulingSettings,
  updatePersonalCommitment,
} from '@infrastructure/supabase/scheduling.repository.js';

export const createPsychologistSchedulingRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get(
      '/psychologist/scheduling',
      { preHandler: validateQuery(schedulingWeekQuerySchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const query = request.query as { weekStart: string };
        const week = await getPsychologistSchedulingWeek(
          admin,
          auth.userId,
          query.weekStart
        );
        return { scheduling: week };
      }
    );

    app.put(
      '/psychologist/scheduling/settings',
      { preHandler: validateBody(updateSchedulingSettingsBodySchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const body = request.body as {
          sessionDurationMinutes: number;
          dayStartTime: string;
          dayEndTime: string;
          breakIntervals: { startTime: string; endTime: string }[];
          confirmRemoveConflicts?: boolean;
          tzOffset: number;
        };

        const result = await updatePsychologistSchedulingSettings(admin, auth.userId, {
          sessionDurationMinutes: body.sessionDurationMinutes,
          dayStartTime: body.dayStartTime,
          dayEndTime: body.dayEndTime,
          breakIntervals: body.breakIntervals,
          confirmRemoveConflicts: body.confirmRemoveConflicts,
          timeZoneOffsetMinutes: body.tzOffset,
        });

        return { result };
      }
    );

    app.post(
      '/psychologist/scheduling/appointments',
      { preHandler: validateBody(createAppointmentBodySchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const body = request.body as {
          patientId?: string;
          startsAt: string;
          durationMinutes?: number;
          notes?: string | null;
          isPersonalCommitment?: boolean;
          personalDescription?: string;
          tzOffset: number;
        };

        const settings = await getSchedulingSettings(admin, auth.userId);
        const durationMinutes = body.durationMinutes ?? settings.sessionDurationMinutes;

        if (body.isPersonalCommitment) {
          const appointment = await createAppointment(admin, {
            psychologistId: auth.userId,
            startsAt: body.startsAt,
            durationMinutes,
            notes: body.personalDescription!.trim(),
            isPersonalCommitment: true,
          });

          return { appointment };
        }

        const patient = await getPatientForPsychologist(
          admin,
          auth.userId,
          body.patientId!,
          { includeDeleted: false }
        );

        if (!patient) {
          return reply.status(404).send({ error: 'Patient not found' });
        }

        const appointment = await createAppointment(admin, {
          psychologistId: auth.userId,
          patientId: body.patientId,
          startsAt: body.startsAt,
          durationMinutes,
          notes: body.notes,
        });

        return { appointment };
      }
    );

    app.patch(
      '/psychologist/scheduling/appointments/:appointmentId',
      {
        preHandler: [
          validateParams(appointmentIdParamsSchema),
          validateBody(updatePersonalCommitmentBodySchema),
        ],
      },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { appointmentId } = request.params as { appointmentId: string };
        const body = request.body as {
          startsAt: string;
          durationMinutes: number;
          personalDescription: string;
        };

        const existing = await getAppointmentById(admin, auth.userId, appointmentId);
        if (!existing) {
          return reply.status(404).send({ error: 'Appointment not found' });
        }
        if (!existing.isPersonalCommitment) {
          throw new BadRequestError('Only personal commitments can be updated with this endpoint');
        }

        const appointment = await updatePersonalCommitment(admin, auth.userId, appointmentId, {
          startsAt: body.startsAt,
          durationMinutes: body.durationMinutes,
          notes: body.personalDescription,
        });

        return { appointment };
      }
    );

    app.patch(
      '/psychologist/scheduling/appointments/:appointmentId/move',
      {
        preHandler: [
          validateParams(appointmentIdParamsSchema),
          validateBody(moveAppointmentBodySchema),
        ],
      },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { appointmentId } = request.params as { appointmentId: string };
        const body = request.body as {
          startsAt: string;
          weekStart: string;
          tzOffset: number;
        };

        const settings = await getSchedulingSettings(admin, auth.userId);
        const updated = await movePsychologistAppointment(
          admin,
          auth.userId,
          appointmentId,
          body.startsAt,
          {
            sessionDurationMinutes: settings.sessionDurationMinutes,
            dayStartTime: settings.dayStartTime,
            dayEndTime: settings.dayEndTime,
            breakIntervals: settings.breakIntervals,
          },
          body.tzOffset,
          body.weekStart
        );

        return { appointments: updated };
      }
    );

    app.delete(
      '/psychologist/scheduling/appointments/:appointmentId',
      { preHandler: validateParams(appointmentIdParamsSchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);
        const { appointmentId } = request.params as { appointmentId: string };

        try {
          await deleteAppointment(admin, auth.userId, appointmentId);
        } catch {
          throw new NotFoundError('Appointment not found');
        }

        return reply.status(204).send();
      }
    );
  };
