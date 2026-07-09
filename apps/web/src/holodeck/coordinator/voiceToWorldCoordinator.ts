import type {
  HolodeckApi,
  VoiceToWorldJob
} from "../api/holodeckApiClient";
import type { WorldRenderer } from "../rendering/worldRenderer";
import type { HolodeckStateMachine } from "../state/holodeckState";
import type { WorldResult } from "../world/worldResult";

interface VoiceToWorldCoordinatorDeps {
  state: HolodeckStateMachine;
  api: HolodeckApi;
  renderer: WorldRenderer;
  pollIntervalMs?: number;
  onProgress?: (job: VoiceToWorldJob, progress: VoiceToWorldProgress) => void;
  onWorldShown?: (world: WorldResult) => void;
}

export interface VoiceToWorldProgress {
  pollCount: number;
  elapsedMs: number;
}

export class VoiceToWorldCoordinator {
  private isGenerating = false;

  constructor(private readonly deps: VoiceToWorldCoordinatorDeps) {}

  async generateFromAudio(audio: Blob): Promise<WorldResult | null> {
    const { state, api, renderer } = this.deps;

    if (this.isGenerating) {
      state.setError("World generation is already running.");
      return null;
    }

    if (audio.size === 0) {
      state.setError("No audio was captured.");
      return null;
    }

    this.isGenerating = true;
    state.forceState("Interpreting");

    try {
      const world =
        api.startVoiceToWorldJob && api.getVoiceToWorldJob
          ? await this.generateFromJob(audio)
          : await this.generateFromBlockingRequest(audio);
      await renderer.load(world);
      renderer.show();
      this.deps.onWorldShown?.(world);

      if (!state.tryTransitionTo("Ready")) {
        state.forceState("Ready");
      }

      return world;
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Voice-to-world failed.");
      return null;
    } finally {
      this.isGenerating = false;
    }
  }

  private async generateFromBlockingRequest(audio: Blob) {
    this.deps.state.forceState("Generating");
    return this.deps.api.voiceToWorld(audio);
  }

  private async generateFromJob(audio: Blob) {
    const { api, state } = this.deps;
    const startedAt = Date.now();
    let pollCount = 0;

    if (!api.startVoiceToWorldJob || !api.getVoiceToWorldJob) {
      return this.generateFromBlockingRequest(audio);
    }

    let job = await api.startVoiceToWorldJob(audio);
    this.reportJob(job, {
      pollCount,
      elapsedMs: Date.now() - startedAt
    });

    while (job.status === "queued" || job.status === "running") {
      state.forceState(job.stage === "transcription" ? "Interpreting" : "Generating");
      await sleep(this.deps.pollIntervalMs ?? 2_000);
      pollCount += 1;
      job = await api.getVoiceToWorldJob(job.jobId);
      this.reportJob(job, {
        pollCount,
        elapsedMs: Date.now() - startedAt
      });
    }

    if (job.status === "error") {
      throw new Error(job.error ?? job.message ?? "Voice-to-world job failed.");
    }

    if (!job.world) {
      throw new Error("Voice-to-world job completed without a world.");
    }

    state.forceState("Generating");
    return job.world;
  }

  private reportJob(job: VoiceToWorldJob, progress: VoiceToWorldProgress) {
    this.deps.onProgress?.(job, progress);
  }
}

function sleep(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}
