import type { FastifyInstance } from "fastify";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

export interface WorldLabsWorldRouteDeps {
  worldLabsClient: Pick<
    WorldLabsClient,
    "listWorlds" | "getWorld" | "deleteWorld"
  >;
}

export async function registerWorldLabsWorldRoutes(
  app: FastifyInstance,
  deps: WorldLabsWorldRouteDeps
) {
  app.get<{
    Querystring: { pageSize?: string; pageToken?: string };
  }>("/api/worldlabs/worlds", async (request, reply) => {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.raw.once("aborted", abort);

    try {
      const pageSize = clampPageSize(request.query.pageSize);
      const pageToken = readQueryValue(request.query.pageToken);
      const page = await deps.worldLabsClient.listWorlds({
        pageSize,
        ...(pageToken ? { pageToken } : {}),
        signal: abortController.signal
      });

      return reply.send(page);
    } catch (error) {
      if (abortController.signal.aborted) {
        request.log.info({ err: error }, "worldlabs world list request aborted");
        return reply.code(499).send({ error: "Request aborted" });
      }

      request.log.warn({ err: error }, "worldlabs world list failed");
      return reply.code(502).send({ error: "WorldLabs list unavailable" });
    } finally {
      request.raw.off("aborted", abort);
    }
  });

  app.get<{
    Params: { worldId: string };
  }>("/api/worldlabs/worlds/:worldId", async (request, reply) => {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.raw.once("aborted", abort);

    try {
      const worldId = normalizeWorldId(request.params.worldId);

      if (!worldId) {
        return reply.code(400).send({ error: "Invalid WorldLabs world id" });
      }

      const world = await deps.worldLabsClient.getWorld(
        worldId,
        abortController.signal
      );
      return reply.send(world);
    } catch (error) {
      if (abortController.signal.aborted) {
        request.log.info({ err: error }, "worldlabs world fetch request aborted");
        return reply.code(499).send({ error: "Request aborted" });
      }

      request.log.warn({ err: error }, "worldlabs world fetch failed");
      return reply.code(502).send({ error: "WorldLabs world unavailable" });
    } finally {
      request.raw.off("aborted", abort);
    }
  });

  app.delete<{
    Params: { worldId: string };
  }>("/api/worldlabs/worlds/:worldId", async (request, reply) => {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.raw.once("aborted", abort);

    try {
      const worldId = normalizeWorldId(request.params.worldId);

      if (!worldId) {
        return reply.code(400).send({ error: "Invalid WorldLabs world id" });
      }

      const result = await deps.worldLabsClient.deleteWorld(
        worldId,
        abortController.signal
      );
      return reply.send(result);
    } catch (error) {
      if (abortController.signal.aborted) {
        request.log.info({ err: error }, "worldlabs world delete request aborted");
        return reply.code(499).send({ error: "Request aborted" });
      }

      request.log.warn({ err: error }, "worldlabs world delete failed");
      return reply.code(502).send({ error: "WorldLabs delete failed" });
    } finally {
      request.raw.off("aborted", abort);
    }
  });
}

function clampPageSize(pageSize: unknown): number {
  const parsed = Number.parseInt(readQueryValue(pageSize), 10);

  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function readQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return readQueryValue(value[0]);
  }

  return typeof value === "string" ? value.trim() : "";
}

function normalizeWorldId(worldId: unknown): string {
  const trimmedWorldId = readQueryValue(worldId);

  if (!trimmedWorldId.includes("/") && !trimmedWorldId.includes("\\")) {
    return trimmedWorldId;
  }

  return "";
}
