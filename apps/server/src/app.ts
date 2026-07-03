import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import {
  registerVoiceToWorldRoute,
  type VoiceToWorldRouteDeps
} from "./routes/voiceToWorld.js";

interface BuildServerOptions {
  voiceToWorld?: VoiceToWorldRouteDeps;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true
  });
  await app.register(multipart);

  app.get("/health", async () => ({
    ok: true,
    service: "headset-holodeck-web-server"
  }));

  if (options.voiceToWorld) {
    await registerVoiceToWorldRoute(app, options.voiceToWorld);
  }

  return app;
}
