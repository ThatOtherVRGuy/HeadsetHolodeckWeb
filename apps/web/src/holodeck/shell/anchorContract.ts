import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export const REQUIRED_SHELL_ANCHORS = [
  "WorldRoot",
  "GeneratedWorldRoot",
  "MainStatusPanelAnchor",
  "RecordControlAnchor",
  "UserStartPose"
] as const;

export type ShellAnchorName = (typeof REQUIRED_SHELL_ANCHORS)[number];

export type ShellAnchorMap = Partial<Record<ShellAnchorName, Object3D>>;

export interface ShellAnchorResolution {
  anchors: ShellAnchorMap;
  missing: ShellAnchorName[];
}
