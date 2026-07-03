import type { FastifyInstance } from "fastify";
import type { TranscriptionClient } from "../openai/transcriptionClient.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

export interface VoiceToWorldRouteDeps {
  transcriptionClient: TranscriptionClient;
  worldLabsClient: Pick<WorldLabsClient, "generateWorldFromText">;
}

export async function registerVoiceToWorldRoute(
  app: FastifyInstance,
  deps: VoiceToWorldRouteDeps
) {
  app.post("/api/voice-to-world", async (request, reply) => {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    const abortIfResponseDidNotFinish = () => {
      if (!reply.raw.writableEnded) {
        abort();
      }
    };
    request.raw.once("aborted", abort);
    reply.raw.once("close", abortIfResponseDidNotFinish);

    const file = await request.file();

    if (!file || file.fieldname !== "audio") {
      removeAbortListeners();
      return reply.code(400).send({
        error: "Audio file is required"
      });
    }

    const audio = await file.toBuffer();

    if (audio.length === 0) {
      removeAbortListeners();
      return reply.code(400).send({
        error: "Audio file is empty"
      });
    }

    let stage: "transcription" | "world-generation" = "transcription";

    try {
      const transcript = await deps.transcriptionClient.transcribe(
        new Uint8Array(audio),
        file.filename,
        file.mimetype,
        { signal: abortController.signal }
      );
      stage = "world-generation";
      const world = await deps.worldLabsClient.generateWorldFromText(
        transcript,
        transcript,
        { signal: abortController.signal }
      );

      return reply.send(world);
    } catch (error) {
      if (abortController.signal.aborted) {
        request.log.info({ err: error }, "voice-to-world request aborted");
        return reply.code(499).send({
          error: "Request aborted"
        });
      }

      const message = error instanceof Error ? error.message : "";
      request.log.warn({ err: error }, "voice-to-world upstream request failed");

      if (stage === "transcription") {
        return reply.code(502).send({
          error: "Transcription failed"
        });
      }

      if (message.toLowerCase().includes("timed out")) {
        return reply.code(504).send({
          error: "World generation timed out"
        });
      }

      return reply.code(502).send({
        error: "World generation failed"
      });
    } finally {
      removeAbortListeners();
    }

    function removeAbortListeners() {
      request.raw.off("aborted", abort);
      reply.raw.off("close", abortIfResponseDidNotFinish);
    }
  });
}
