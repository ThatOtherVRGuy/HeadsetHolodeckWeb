import {
  Object3D,
  Quaternion,
  Vector3,
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const PANEL_DISTANCE = -0.75;
const PANEL_HEIGHT_OFFSET = -0.2;
const panelAnchorWorldPosition = new Vector3();
const panelAnchorWorldQuaternion = new Quaternion();

export interface PanelCompositionTargets {
  panel: PlacementTarget;
  statusPanel: PlacementTarget;
  generatedWorld: PlacementTarget;
}

export function placePanelForShellComposition(
  panel: Object3D,
  camera: Object3D,
  targets: PanelCompositionTargets
): void {
  if (targets.panel.object) {
    targets.panel.object.updateMatrixWorld(true);
    targets.panel.object.getWorldPosition(panelAnchorWorldPosition);
    targets.panel.object.getWorldQuaternion(panelAnchorWorldQuaternion);
    panel.position.copy(panelAnchorWorldPosition);
    panel.quaternion.copy(panelAnchorWorldQuaternion);
    return;
  }

  camera.add(panel);
  panel.position.set(0, PANEL_HEIGHT_OFFSET, PANEL_DISTANCE);
  panel.rotation.set(0, 0, 0);
}
