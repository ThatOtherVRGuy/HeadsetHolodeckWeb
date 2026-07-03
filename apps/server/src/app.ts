import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import {
  registerVoiceToWorldRoute,
  type VoiceToWorldRouteDeps
} from "./routes/voiceToWorld.js";

interface BuildServerOptions {
  voiceToWorld?: VoiceToWorldRouteDeps;
  generatedWorldsDir?: string;
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

  if (options.generatedWorldsDir) {
    const generatedWorldsDir = resolve(options.generatedWorldsDir);
    app.get("/generated-worlds", async () => {
      const splats = [];
      const worldEntries = await readdir(generatedWorldsDir, {
        withFileTypes: true
      });

      for (const worldEntry of worldEntries) {
        if (!worldEntry.isDirectory() || !isSafePathSegment(worldEntry.name)) {
          continue;
        }

        const worldDir = resolve(join(generatedWorldsDir, worldEntry.name));
        if (!isPathInside(worldDir, generatedWorldsDir)) {
          continue;
        }

        const fileEntries = await readdir(worldDir, { withFileTypes: true });
        for (const fileEntry of fileEntries) {
          if (
            !fileEntry.isFile() ||
            !isSafePathSegment(fileEntry.name) ||
            !fileEntry.name.toLowerCase().endsWith(".spz")
          ) {
            continue;
          }

          const filePath = resolve(join(worldDir, fileEntry.name));
          if (!isPathInside(filePath, generatedWorldsDir)) {
            continue;
          }

          const fileStat = await stat(filePath);
          splats.push({
            worldId: worldEntry.name,
            fileName: fileEntry.name,
            byteLength: fileStat.size,
            publicUrl: `/generated-worlds/${encodeURIComponent(
              worldEntry.name
            )}/${encodeURIComponent(fileEntry.name)}`
          });
        }
      }

      splats.sort((left, right) =>
        left.worldId.localeCompare(right.worldId) ||
        left.fileName.localeCompare(right.fileName)
      );

      return { splats };
    });

    app.get<{
      Params: { worldId: string; fileName: string };
    }>("/generated-worlds/:worldId/:fileName", async (request, reply) => {
      const { worldId, fileName } = request.params;

      if (!isSafePathSegment(worldId) || !isSafePathSegment(fileName)) {
        return reply.code(400).send({ error: "Invalid generated world path" });
      }

      const filePath = resolve(join(generatedWorldsDir, worldId, fileName));

      if (!isPathInside(filePath, generatedWorldsDir)) {
        return reply.code(400).send({ error: "Invalid generated world path" });
      }

      try {
        const fileStat = await stat(filePath);

        if (!fileStat.isFile()) {
          return reply
            .code(404)
            .send({ error: "Generated world file not found" });
        }

        reply.header("content-type", "model/vnd.spz");
        reply.header("content-length", fileStat.size.toString());
        return reply.send(createReadStream(filePath));
      } catch (error) {
        return reply.code(404).send({ error: "Generated world file not found" });
      }
    });
  }

  if (options.voiceToWorld) {
    await registerVoiceToWorldRoute(app, options.voiceToWorld);
  }

  return app;
}

function isSafePathSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function isPathInside(filePath: string, parentPath: string) {
  const normalizedParent = parentPath.endsWith(sep)
    ? parentPath
    : `${parentPath}${sep}`;

  return filePath.startsWith(normalizedParent);
}
