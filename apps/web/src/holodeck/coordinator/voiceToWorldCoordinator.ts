import type {
  HolodeckApi,
  VoiceToWorldJob
} from "../api/holodeckApiClient";
import type { WorldRenderer } from "../rendering/worldRenderer";
import type { HolodeckStateMachine } from "../state/holodeckState";

interface VoiceToWorldCoordinatorDeps {
  state: HolodeckStateMachine;
  api: HolodeckApi;
  renderer: WorldRenderer;
  pollIntervalMs?: number;
  onProgress?: (job: VoiceToWorldJob) => void;
}

export class VoiceToWorldCoordinator {
  private isGenerating = false;

  constructor(private readonly deps: VoiceToWorldCoordinatorDeps) {}

  async generateFromAudio(audio: Blob): Promise<void> {
    const { state, api, renderer } = this.deps;

    if (this.isGenerating) {
      state.setError("World generation is already running.");
      return;
    }

    if (audio.size === 0) {
      state.setError("No audio was captured.");
      return;
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

      if (!state.tryTransitionTo("Ready")) {
        state.forceState("Ready");
      }
    } catch (error) {
      state.setError(error instanceof Error ? error.message : "Voice-to-world failed.");
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

    if (!api.startVoiceToWorldJob || !api.getVoiceToWorldJob) {
      return this.generateFromBlockingRequest(audio);
    }

    let job = await api.startVoiceToWorldJob(audio);
    this.reportJob(job);

    while (job.status === "queued" || job.status === "running") {
      state.forceState(job.stage === "transcription" ? "Interpreting" : "Generating");
      await sleep(this.deps.pollIntervalMs ?? 2_000);
      job = await api.getVoiceToWorldJob(job.jobId);
      this.reportJob(job);
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

  private reportJob(job: VoiceToWorldJob) {
    this.deps.onProgress?.(job);
  }
}

function sleep(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}
