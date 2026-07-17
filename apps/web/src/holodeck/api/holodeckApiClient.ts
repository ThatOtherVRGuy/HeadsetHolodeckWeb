import type {
  WorldLabsDeleteResult,
  WorldLabsWorldPage,
  WorldResult,
} from "../world/worldResult";

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
  transcribeAudio?(audio: Blob): Promise<string>;
  voiceToWorld(audio: Blob): Promise<WorldResult>;
  startVoiceToWorldJob?(audio: Blob): Promise<VoiceToWorldJob>;
  startTextToWorldJob?(transcript: string): Promise<VoiceToWorldJob>;
  getVoiceToWorldJob?(jobId: string): Promise<VoiceToWorldJob>;
  listWorldLabsWorlds?(options?: {
    pageSize?: number;
    pageToken?: string;
  }): Promise<WorldLabsWorldPage>;
  getWorldLabsWorld?(worldId: string): Promise<WorldResult>;
  deleteWorldLabsWorld?(worldId: string): Promise<WorldLabsDeleteResult>;
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

  async transcribeAudio(audio: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", audio, "command.webm");

    const response = await this.fetchImpl(this.apiUrl("/api/transcriptions"), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Transcription failed: HTTP ${response.status} ${body}`);
    }

    const body = (await response.json()) as { transcript?: unknown };
    if (typeof body.transcript !== "string") {
      throw new Error("Transcription response did not include transcript.");
    }

    return body.transcript;
  }

  async voiceToWorld(audio: Blob): Promise<WorldResult> {
    const formData = new FormData();
    formData.append("audio", audio, "command.webm");

    const response = await this.fetchImpl(
      this.apiUrl("/api/voice-to-world"),
      {
        method: "POST",
        body: formData,
      }
    );

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
      this.apiUrl("/api/voice-to-world/jobs"),
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

  async startTextToWorldJob(transcript: string): Promise<VoiceToWorldJob> {
    const response = await this.fetchImpl(
      this.apiUrl("/api/voice-to-world/text-jobs"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ transcript })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Text-to-world job failed: HTTP ${response.status} ${body}`);
    }

    return this.normalizeJob((await response.json()) as VoiceToWorldJob);
  }

  async getVoiceToWorldJob(jobId: string): Promise<VoiceToWorldJob> {
    const response = await this.fetchImpl(
      this.apiUrl(`/api/voice-to-world/jobs/${encodeURIComponent(jobId)}`)
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Voice-to-world job status failed: HTTP ${response.status} ${body}`
      );
    }

    return this.normalizeJob((await response.json()) as VoiceToWorldJob);
  }

  async listWorldLabsWorlds(options?: {
    pageSize?: number;
    pageToken?: string;
  }): Promise<WorldLabsWorldPage> {
    const searchParams = new URLSearchParams();

    if (options?.pageSize !== undefined) {
      searchParams.set("pageSize", String(options.pageSize));
    }

    if (options?.pageToken !== undefined) {
      searchParams.set("pageToken", options.pageToken);
    }

    const query = searchParams.toString();
    const response = await this.fetchImpl(
      this.apiUrl(`/api/worldlabs/worlds${query ? `?${query}` : ""}`)
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `World Labs world list failed: HTTP ${response.status} ${body}`
      );
    }

    return (await response.json()) as WorldLabsWorldPage;
  }

  async getWorldLabsWorld(worldId: string): Promise<WorldResult> {
    const response = await this.fetchImpl(
      this.apiUrl(`/api/worldlabs/worlds/${encodeURIComponent(worldId)}`)
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `World Labs world fetch failed: HTTP ${response.status} ${body}`
      );
    }

    return this.normalizeWorld((await response.json()) as WorldResult);
  }

  async deleteWorldLabsWorld(worldId: string): Promise<WorldLabsDeleteResult> {
    const response = await this.fetchImpl(
      this.apiUrl(`/api/worldlabs/worlds/${encodeURIComponent(worldId)}`),
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `World Labs world delete failed: HTTP ${response.status} ${body}`
      );
    }

    return (await response.json()) as WorldLabsDeleteResult;
  }

  private normalizeJob(job: VoiceToWorldJob) {
    if (job.world) {
      job.world = this.normalizeWorld(job.world);
    }

    return job;
  }

  private normalizeWorld(world: WorldResult) {
    if (world.localSplat?.publicUrl) {
      world.localSplat.publicUrl = this.assetUrl(world.localSplat.publicUrl);
    }

    return world;
  }

  private apiUrl(path: string) {
    return `${this.baseUrl}${path}`;
  }

  private assetUrl(url: string) {
    if (this.baseUrl === "") {
      return url;
    }

    return new URL(url, this.baseUrl).toString();
  }
}
