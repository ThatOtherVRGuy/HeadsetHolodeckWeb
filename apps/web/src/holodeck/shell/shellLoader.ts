import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { Vector3 } from "@iwsdk/core/dist/runtime/three.js";
import type { ShellAnchorName } from "./anchorContract.js";
import { resolveShellAnchors } from "./anchorResolver.js";
import {
  createDebugShellPlacement,
  createShellPlacement,
  type ShellPlacement
} from "./placement.js";
import { freezeTransformStaticObjects } from "./staticIntent.js";

export type ShellLoadStatus = "loaded" | "missing-asset" | "missing-anchors";

export interface ShellLoadOptions {
  assetId: string;
  getGltfScene(assetId: string): Object3D | null;
  createTransformEntity(object: Object3D): unknown;
}

export interface ShellLoadResult {
  status: ShellLoadStatus;
  root: Object3D | null;
  placement: ShellPlacement;
  missingAnchors: ShellAnchorName[];
  message: string;
}

const XR_ARCH_VIEW_SHELL_OFFSET = new Vector3(-1.8, 0, 3);

export function loadHolodeckShell(options: ShellLoadOptions): ShellLoadResult {
  const root = options.getGltfScene(options.assetId);
  if (!root) {
    return {
      status: "missing-asset",
      root: null,
      placement: createDebugShellPlacement(),
      missingAnchors: [],
      message: `Holodeck shell asset ${options.assetId} was not loaded.`
    };
  }

  root.name = root.name || "HolodeckShell";
  root.position.copy(XR_ARCH_VIEW_SHELL_OFFSET);
  options.createTransformEntity(root);

  const resolution = resolveShellAnchors(root);
  const placement = createShellPlacement(resolution.anchors);
  freezeTransformStaticObjects(root);

  if (resolution.missing.length > 0) {
    return {
      status: "missing-anchors",
      root,
      placement,
      missingAnchors: resolution.missing,
      message: `Missing holodeck shell anchors: ${resolution.missing.join(", ")}`
    };
  }

  return {
    status: "loaded",
    root,
    placement,
    missingAnchors: [],
    message: "Holodeck shell loaded."
  };
}
