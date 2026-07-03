import type { WorldResult } from "../world/worldResult";

export interface WorldRenderer {
  readonly mode: "static" | "panorama" | "splat" | "mesh";
  load(world: WorldResult): Promise<void>;
  show(): void;
  hide(): void;
  dispose(): void;
}
