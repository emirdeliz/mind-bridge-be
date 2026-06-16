import type { FastifyPluginAsync } from 'fastify';

import {
  assertPsychologist,
  NotFoundError,
} from '@application/authorization.js';
import { getPsychologistPatientPayments } from '@application/get-psychologist-patient-payments.js';
import type { Env } from '@config/env.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@http/middleware/validate.js';
import {
  getPatientPaymentsQuerySchema,
  patientPaymentIdParamsSchema,
  upsertPatientPaymentBodySchema,
} from '@http/schemas/patient-payment.schemas.js';
import { createAdminSupabaseClient } from '@infrastructure/supabase/client.js';
import {
  deletePatientSessionPayment,
  upsertPatientSessionPayment,
} from '@infrastructure/supabase/patient-payment.repository.js';
import { getPatientForPsychologist } from '@infrastructure/supabase/patient.repository.js';

export const createPsychologistPatientPaymentsRoutes =
  (env: Env): FastifyPluginAsync =>
  async (app) => {
    const admin = createAdminSupabaseClient(env);

    app.get(
      '/psychologist/patient-payments',
      { preHandler: validateQuery(getPatientPaymentsQuerySchema) },
      async (request) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const query = request.query as { month?: string };
        const summary = await getPsychologistPatientPayments(
          admin,
          auth.userId,
          { billingMonth: query.month }
        );

        return { summary };
      }
    );

    app.post(
      '/psychologist/patient-payments',
      { preHandler: validateBody(upsertPatientPaymentBodySchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const body = request.body as {
          patientId: string;
          billingMonth: string;
          amountCents: number;
          paidAt?: string;
          notes?: string | null;
        };

        const patient = await getPatientForPsychologist(
          admin,
          auth.userId,
          body.patientId,
          { includeDeleted: true }
        );

        if (!patient) {
          return reply.status(404).send({ error: 'Patient not found' });
        }

        const payment = await upsertPatientSessionPayment(admin, {
          psychologistId: auth.userId,
          patientId: body.patientId,
          billingMonth: body.billingMonth,
          amountCents: body.amountCents,
          paidAt: body.paidAt,
          notes: body.notes,
        });

        return reply.status(201).send({ payment });
      }
    );

    app.delete(
      '/psychologist/patient-payments/:paymentId',
      { preHandler: validateParams(patientPaymentIdParamsSchema) },
      async (request, reply) => {
        const auth = request.auth!;
        assertPsychologist(auth);

        const { paymentId } = request.params as { paymentId: string };

        try {
          await deletePatientSessionPayment(admin, auth.userId, paymentId);
          return reply.status(204).send();
        } catch (error) {
          if (error instanceof NotFoundError) {
            return reply.status(404).send({ error: error.message });
          }
          throw error;
        }
      }
    );
  };
