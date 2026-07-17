import type { FastifyInstance } from "fastify";
import type { TranscriptionClient } from "../openai/transcriptionClient.js";
import type { DownloadedSplat } from "../worldlabs/downloadSplat.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";
import type { WorldLabsProgress } from "../worldlabs/worldLabsClient.js";
import type { WorldResult } from "../worldlabs/worldTypes.js";

export interface VoiceToWorldRouteDeps {
  transcriptionClient: TranscriptionClient;
  worldLabsClient: Pick<WorldLabsClient, "generateWorldFromText">;
  splatDownloader?: (
    world: WorldResult,
    options: { signal: AbortSignal }
  ) => Promise<DownloadedSplat>;
}

type VoiceToWorldJobStage =
  | "queued"
  | "transcription"
  | "world-generation"
  | "splat-download"
  | "complete"
  | "error";

type VoiceToWorldJobStatus = "queued" | "running" | "complete" | "error";

interface VoiceToWorldJob {
  jobId: string;
  status: VoiceToWorldJobStatus;
  stage: VoiceToWorldJobStage;
  message: string;
  createdAt: string;
  updatedAt: string;
  operationId?: string;
  progress?: {
    status: string;
    description?: string;
    worldId?: string;
  };
  world?: WorldResult & { localSplat?: DownloadedSplat };
  error?: string;
}

let nextJobNumber = 1;

export async function registerVoiceToWorldRoute(
  app: FastifyInstance,
  deps: VoiceToWorldRouteDeps
) {
  const jobs = new Map<string, VoiceToWorldJob>();

  app.post("/api/transcriptions", async (request, reply) => {
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

    try {
      const transcript = await deps.transcriptionClient.transcribe(
        new Uint8Array(audio),
        file.filename,
        file.mimetype,
        { signal: abortController.signal }
      );

      return reply.send({ transcript });
    } catch (error) {
      if (abortController.signal.aborted) {
        request.log.info({ err: error }, "transcription request aborted");
        return reply.code(499).send({
          error: "Request aborted"
        });
      }

      request.log.warn({ err: error }, "transcription upstream request failed");
      return reply.code(502).send({
        error: "Transcription failed"
      });
    } finally {
      removeAbortListeners();
    }

    function removeAbortListeners() {
      request.raw.off("aborted", abort);
      reply.raw.off("close", abortIfResponseDidNotFinish);
    }
  });

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
      const localSplat = await tryDownloadSplat(world);

      return reply.send({
        ...world,
        ...(localSplat ? { localSplat } : {})
      });
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

    async function tryDownloadSplat(world: WorldResult) {
      if (!deps.splatDownloader) {
        return null;
      }

      try {
        return await deps.splatDownloader(world, {
          signal: abortController.signal
        });
      } catch (error) {
        request.log.warn({ err: error }, "splat download failed");
        return null;
      }
    }
  });

  app.post("/api/voice-to-world/jobs", async (request, reply) => {
    const file = await request.file();

    if (!file || file.fieldname !== "audio") {
      return reply.code(400).send({
        error: "Audio file is required"
      });
    }

    const audio = await file.toBuffer();

    if (audio.length === 0) {
      return reply.code(400).send({
        error: "Audio file is empty"
      });
    }

    const job = createJob();
    jobs.set(job.jobId, job);

    runVoiceToWorldJob(job, {
      audio: new Uint8Array(audio),
      filename: file.filename,
      mimetype: file.mimetype
    }).catch((error) => {
      request.log.error({ err: error, jobId: job.jobId }, "voice-to-world job crashed");
      markJobError(job, "Voice-to-world job failed");
    });

    return reply.code(202).send(job);
  });

  app.post<{
    Body: { transcript?: string };
  }>("/api/voice-to-world/text-jobs", async (request, reply) => {
    const transcript = request.body?.transcript?.trim();

    if (!transcript) {
      return reply.code(400).send({
        error: "Transcript is required"
      });
    }

    const job = createJob({
      stage: "world-generation",
      message: "Generating world."
    });
    jobs.set(job.jobId, job);

    runTextToWorldJob(job, transcript).catch((error) => {
      request.log.error({ err: error, jobId: job.jobId }, "text-to-world job crashed");
      markJobError(job, "Text-to-world job failed");
    });

    return reply.code(202).send(job);
  });

  app.get<{
    Params: { jobId: string };
  }>("/api/voice-to-world/jobs/:jobId", async (request, reply) => {
    const job = jobs.get(request.params.jobId);

    if (!job) {
      return reply.code(404).send({ error: "Voice-to-world job not found" });
    }

    return reply.send(job);
  });

  function createJob(
    initial: Pick<VoiceToWorldJob, "stage" | "message"> = {
      stage: "transcription",
      message: "Transcribing voice prompt."
    }
  ): VoiceToWorldJob {
    const now = new Date().toISOString();

    return {
      jobId: `job_${nextJobNumber++}`,
      status: "running",
      stage: initial.stage,
      message: initial.message,
      createdAt: now,
      updatedAt: now
    };
  }

  async function runVoiceToWorldJob(
    job: VoiceToWorldJob,
    file: { audio: Uint8Array; filename: string; mimetype: string }
  ) {
    const abortController = new AbortController();

    try {
      const transcript = await deps.transcriptionClient.transcribe(
        file.audio,
        file.filename,
        file.mimetype,
        { signal: abortController.signal }
      );
      updateJob(job, {
        stage: "world-generation",
        message: "Generating world."
      });
      await generateWorldForJob(job, transcript, abortController.signal);
    } catch (error) {
      markJobError(
        job,
        error instanceof Error ? error.message : "Voice-to-world job failed"
      );
    }
  }

  async function runTextToWorldJob(job: VoiceToWorldJob, transcript: string) {
    const abortController = new AbortController();

    try {
      await generateWorldForJob(job, transcript, abortController.signal);
    } catch (error) {
      markJobError(
        job,
        error instanceof Error ? error.message : "Text-to-world job failed"
      );
    }
  }

  async function generateWorldForJob(
    job: VoiceToWorldJob,
    transcript: string,
    signal: AbortSignal
  ) {
    const world = await deps.worldLabsClient.generateWorldFromText(
      transcript,
      transcript,
      {
        signal,
        onProgress: (progress: WorldLabsProgress) => {
          updateJobProgress(job, progress);
        }
      }
    );
    updateJob(job, {
      stage: "splat-download",
      message: "Saving generated splat."
    });
    const localSplat = await tryDownloadSplatForJob(job, world, signal);
    updateJob(job, {
      status: "complete",
      stage: "complete",
      message: "World ready.",
      world: {
        ...world,
        ...(localSplat ? { localSplat } : {})
      }
    });
  }

  function updateJob(job: VoiceToWorldJob, patch: Partial<VoiceToWorldJob>) {
    Object.assign(job, patch, {
      updatedAt: new Date().toISOString()
    });
  }

  function updateJobProgress(job: VoiceToWorldJob, progress: WorldLabsProgress) {
    updateJob(job, {
      stage: "world-generation",
      message: progress.description ?? "Generating world.",
      operationId: progress.operationId,
      progress: {
        status: progress.status,
        ...(progress.description ? { description: progress.description } : {}),
        ...(progress.worldId ? { worldId: progress.worldId } : {})
      }
    });
  }

  function markJobError(job: VoiceToWorldJob, message: string) {
    updateJob(job, {
      status: "error",
      stage: "error",
      message,
      error: message
    });
  }

  async function tryDownloadSplatForJob(
    job: VoiceToWorldJob,
    world: WorldResult,
    signal: AbortSignal
  ) {
    if (!deps.splatDownloader) {
      return null;
    }

    try {
      return await deps.splatDownloader(world, { signal });
    } catch (error) {
      app.log.warn({ err: error, jobId: job.jobId }, "splat download failed");
      return null;
    }
  }
}
