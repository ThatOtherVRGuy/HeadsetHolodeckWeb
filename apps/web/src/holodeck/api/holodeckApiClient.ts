import type { WorldResult } from "../world/worldResult";

export type VoiceToWorldJobStage =
  | "queued"
  | "transcription"
  | "world-generation"
  | "splat-download"
  | "complete"
  | "error";

export type VoiceToWorldJobStatus = "queued" | "running" | "complete" | "error";

export interface VoiceToWorldJob {
  jobId: string;
  status: VoiceToWorldJobStatus;
  stage: VoiceToWorldJobStage;
  message: string;
  createdAt?: string;
  updatedAt?: string;
  operationId?: string;
  progress?: {
    status: string;
    description?: string;
    worldId?: string;
  };
  world?: WorldResult;
  error?: string;
}

export interface HolodeckApi {
  voiceToWorld(audio: Blob): Promise<WorldResult>;
  startVoiceToWorldJob?(audio: Blob): Promise<VoiceToWorldJob>;
  getVoiceToWorldJob?(jobId: string): Promise<VoiceToWorldJob>;
}

export class HolodeckApiClient implements HolodeckApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(
    baseUrl = "http://localhost:4817",
    fetchImpl: typeof globalThis.fetch = globalThis.fetch
  ) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async voiceToWorld(audio: Blob): Promise<WorldResult> {
    const formData = new FormData();
    formData.append("audio", audio, "command.webm");

    const response = await this.fetchImpl(`${this.baseUrl}/api/voice-to-world`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voice-to-world failed: HTTP ${response.status} ${body}`);
    }

    return this.normalizeWorld((await response.json()) as WorldResult);
  }

  async startVoiceToWorldJob(audio: Blob): Promise<VoiceToWorldJob> {
    const formData = new FormData();
    formData.append("audio", audio, "command.webm");

    const response = await this.fetchImpl(
      `${this.baseUrl}/api/voice-to-world/jobs`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Voice-to-world job start failed: HTTP ${response.status} ${body}`
      );
    }

    return this.normalizeJob((await response.json()) as VoiceToWorldJob);
  }

  async getVoiceToWorldJob(jobId: string): Promise<VoiceToWorldJob> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/voice-to-world/jobs/${encodeURIComponent(jobId)}`
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Voice-to-world job status failed: HTTP ${response.status} ${body}`
      );
    }

    return this.normalizeJob((await response.json()) as VoiceToWorldJob);
  }

  private normalizeJob(job: VoiceToWorldJob) {
    if (job.world) {
      job.world = this.normalizeWorld(job.world);
    }

    return job;
  }

  private normalizeWorld(world: WorldResult) {
    if (world.localSplat?.publicUrl) {
      world.localSplat.publicUrl = new URL(
        world.localSplat.publicUrl,
        this.baseUrl
      ).toString();
    }

    return world;
  }
}
