import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import {
  KNOWN_SHELL_ANCHORS,
  REQUIRED_SHELL_ANCHORS,
  type ShellAnchorMap,
  type ShellAnchorName,
  type ShellAnchorResolution
} from "./anchorContract.js";

export function resolveShellAnchors(root: Object3D): ShellAnchorResolution {
  const anchors: ShellAnchorMap = {};
  const known = new Set<ShellAnchorName>(KNOWN_SHELL_ANCHORS);

  root.traverse((object) => {
    if (known.has(object.name as ShellAnchorName)) {
      anchors[object.name as ShellAnchorName] = object;
    }
  });

  return {
    anchors,
    missing: REQUIRED_SHELL_ANCHORS.filter((anchorName) => !anchors[anchorName])
  };
}
