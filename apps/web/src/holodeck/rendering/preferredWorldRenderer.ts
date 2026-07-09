import type { WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

export class PreferredWorldRenderer implements WorldRenderer {
  readonly mode = "splat";
  private activeRenderer: WorldRenderer;

  constructor(
    private readonly preferred: WorldRenderer,
    private readonly fallback: WorldRenderer,
    private readonly options: {
      onActiveRendererChanged?: (
        activeRenderer: "preferred" | "fallback",
        world: WorldResult,
        error?: unknown
      ) => void;
    } = {}
  ) {
    this.activeRenderer = fallback;
  }

  async load(world: WorldResult) {
    this.preferred.hide();
    this.fallback.hide();

    try {
      await this.preferred.load(world);
      this.activeRenderer = this.preferred;
      this.options.onActiveRendererChanged?.("preferred", world);
    } catch (error) {
      console.warn("Preferred world renderer failed; falling back", error);
      await this.fallback.load(world);
      this.activeRenderer = this.fallback;
      this.options.onActiveRendererChanged?.("fallback", world, error);
    }
  }

  show() {
    this.activeRenderer.show();
  }

  hide() {
    this.activeRenderer.hide();
  }

  dispose() {
    this.preferred.dispose();
    this.fallback.dispose();
  }
}
