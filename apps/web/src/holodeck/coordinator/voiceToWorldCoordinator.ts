import type { HolodeckApi } from "../api/holodeckApiClient";
import type { WorldRenderer } from "../rendering/worldRenderer";
import type { HolodeckStateMachine } from "../state/holodeckState";

interface VoiceToWorldCoordinatorDeps {
  state: HolodeckStateMachine;
  api: HolodeckApi;
  renderer: WorldRenderer;
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
      state.forceState("Generating");
      const world = await api.voiceToWorld(audio);
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
}
