import {
  Object3D,
  Quaternion,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import type { ShellAnchorMap, ShellAnchorName } from "./anchorContract.js";

export interface PlacementTarget {
  object: Object3D | null;
  position: Vector3;
  quaternion: Quaternion;
}

export interface ShellPlacement {
  opsPanel: PlacementTarget;
  infoPanel: PlacementTarget;
  statusPanel: PlacementTarget;
  recordControl: PlacementTarget;
  generatedWorld: PlacementTarget;
  userStart: PlacementTarget;
}

const DEBUG_POSITIONS = {
  OpsPanelAnchor: new Vector3(-0.72, 1.12, -1.85),
  InfoPanelAnchor: new Vector3(0.72, 1.12, -1.85),
  StatusPanelAnchor: new Vector3(0, 1.55, -1.9),
  MainStatusPanelAnchor: new Vector3(0, 1.55, -1.9),
  RecordControlAnchor: new Vector3(-0.72, 1.08, -1.85),
  GeneratedWorldRoot: new Vector3(0, 1.2, 0),
  UserStartPose: new Vector3(-4, 1.5, -6)
} satisfies Record<Exclude<ShellAnchorName, "WorldRoot">, Vector3>;

export function createDebugShellPlacement(): ShellPlacement {
  return createShellPlacement({});
}

export function createShellPlacement(anchors: ShellAnchorMap): ShellPlacement {
  const opsPanel = targetFromAnchor(
    anchors.OpsPanelAnchor ?? anchors.RecordControlAnchor ?? null,
    DEBUG_POSITIONS.OpsPanelAnchor
  );

  return {
    opsPanel,
    infoPanel: targetFromAnchor(
      anchors.InfoPanelAnchor ?? null,
      DEBUG_POSITIONS.InfoPanelAnchor
    ),
    statusPanel: targetFromAnchor(
      anchors.StatusPanelAnchor ?? anchors.MainStatusPanelAnchor ?? null,
      DEBUG_POSITIONS.StatusPanelAnchor
    ),
    recordControl: opsPanel,
    generatedWorld: targetFromAnchor(
      anchors.GeneratedWorldRoot ?? null,
      DEBUG_POSITIONS.GeneratedWorldRoot
    ),
    userStart: targetFromAnchor(
      anchors.UserStartPose ?? null,
      DEBUG_POSITIONS.UserStartPose
    )
  };
}

function targetFromAnchor(
  anchor: Object3D | null,
  fallbackPosition: Vector3
): PlacementTarget {
  if (!anchor) {
    return {
      object: null,
      position: fallbackPosition.clone(),
      quaternion: new Quaternion()
    };
  }

  return {
    object: anchor,
    position: anchor.position.clone(),
    quaternion: anchor.quaternion.clone()
  };
}
