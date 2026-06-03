import type { ObjectSchema } from 'joi';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const validateBody =
  (schema: ObjectSchema) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { value, error } = schema.validate(request.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          path: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    request.body = value;
  };

export const validateParams =
  (schema: ObjectSchema) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { value, error } = schema.validate(request.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          path: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    request.params = value;
  };

export const validateQuery =
  (schema: ObjectSchema) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { value, error } = schema.validate(request.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          path: detail.path.join('.'),
          message: detail.message,
        })),
      });
    }

    request.query = value;
  };
