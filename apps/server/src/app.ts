import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true
  });
  await app.register(multipart);

  app.get("/health", async () => ({
    ok: true,
    service: "headset-holodeck-web-server"
  }));

  return app;
}
