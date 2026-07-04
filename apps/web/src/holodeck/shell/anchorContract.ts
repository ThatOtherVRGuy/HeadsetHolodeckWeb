import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export const REQUIRED_SHELL_ANCHORS = [
  "WorldRoot",
  "GeneratedWorldRoot",
  "OpsPanelAnchor",
  "InfoPanelAnchor",
  "StatusPanelAnchor",
  "UserStartPose"
] as const;

export const LEGACY_SHELL_ANCHORS = [
  "MainStatusPanelAnchor",
  "RecordControlAnchor"
] as const;

export const KNOWN_SHELL_ANCHORS = [
  ...REQUIRED_SHELL_ANCHORS,
  ...LEGACY_SHELL_ANCHORS
] as const;

export type ShellAnchorName = (typeof KNOWN_SHELL_ANCHORS)[number];
export type RequiredShellAnchorName = (typeof REQUIRED_SHELL_ANCHORS)[number];

export type ShellAnchorMap = Partial<Record<ShellAnchorName, Object3D>>;

export interface ShellAnchorResolution {
  anchors: ShellAnchorMap;
  missing: ShellAnchorName[];
}
