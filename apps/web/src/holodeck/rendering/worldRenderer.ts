import type { WorldResult } from "../world/worldResult";
import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export interface WorldRenderer {
  readonly mode: "static" | "panorama" | "splat" | "mesh";
  load(world: WorldResult): Promise<void>;
  show(): void;
  hide(): void;
  dispose(): void;
  getTransformTarget?(): Object3D | null;
}
