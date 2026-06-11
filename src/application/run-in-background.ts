import type { FastifyBaseLogger } from 'fastify';

export const runInBackground = (
  logger: FastifyBaseLogger,
  label: string,
  task: () => Promise<void>
): void => {
  void task().catch((error) => {
    logger.error({ err: error }, `Background task failed: ${label}`);
  });
};
