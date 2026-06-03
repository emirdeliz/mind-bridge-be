import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", { config: { public: true } }, async () => ({
    status: "ok",
    service: "mind-bridge-be",
  }));
};
