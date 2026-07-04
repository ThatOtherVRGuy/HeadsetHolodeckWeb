import {
  Object3D,
  Vector3,
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const PANEL_DISTANCE = -0.75;
const PANEL_HEIGHT_OFFSET = -0.2;

export interface PanelCompositionTargets {
  statusPanel: PlacementTarget;
  generatedWorld: PlacementTarget;
}

export function placePanelForShellComposition(
  panel: Object3D,
  camera: Object3D,
  targets: PanelCompositionTargets
): void {
  if (targets.statusPanel.object) {
    if (panel.parent) {
      panel.parent.remove(panel);
    }

    panel.position.copy(targets.statusPanel.position);
    panel.rotation.set(
      0,
      yawToward(panel.position, targets.generatedWorld.position),
      0
    );
    return;
  }

  camera.add(panel);
  panel.position.set(0, PANEL_HEIGHT_OFFSET, PANEL_DISTANCE);
  panel.rotation.set(0, 0, 0);
}

function yawToward(position: Vector3, target: Vector3) {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5) {
    return 0;
  }

  return Math.atan2(-dx, -dz);
}
