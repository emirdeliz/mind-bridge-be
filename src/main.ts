import { loadEnv } from '@config/env.js';
import { buildServer } from '@http/server.js';

const start = async () => {
  const env = loadEnv();
  const app = await buildServer(env);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`mind-bridge-be listening on port ${env.PORT}`);
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
