import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import {
  REQUIRED_SHELL_ANCHORS,
  type ShellAnchorMap,
  type ShellAnchorName,
  type ShellAnchorResolution
} from "./anchorContract.js";

export function resolveShellAnchors(root: Object3D): ShellAnchorResolution {
  const anchors: ShellAnchorMap = {};
  const required = new Set<ShellAnchorName>(REQUIRED_SHELL_ANCHORS);

  root.traverse((object) => {
    if (required.has(object.name as ShellAnchorName)) {
      anchors[object.name as ShellAnchorName] = object;
    }
  });

  return {
    anchors,
    missing: REQUIRED_SHELL_ANCHORS.filter((anchorName) => !anchors[anchorName])
  };
}
