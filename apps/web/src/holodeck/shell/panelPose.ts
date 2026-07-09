import {
  Euler,
  Object3D,
  Quaternion,
  Vector3,
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const PANEL_DISTANCE = -0.75;
const PANEL_HEIGHT_OFFSET = -0.2;
const PANEL_ANCHOR_STANDOFF_METERS = 0.015;
const STATUS_PANEL_YAW_RADIANS = Math.PI;
const LEFT_ARCH_PANEL_YAW_RADIANS = Math.PI / 2;
const RIGHT_ARCH_PANEL_YAW_RADIANS = -Math.PI / 2;
const panelAnchorWorldPosition = new Vector3();
const panelAnchorWorldQuaternion = new Quaternion();
const statusPanelWorldPosition = new Vector3();
const statusPanelWorldQuaternion = new Quaternion().setFromEuler(
  new Euler(0, STATUS_PANEL_YAW_RADIANS, 0)
);
const leftArchPanelWorldQuaternion = new Quaternion().setFromEuler(
  new Euler(0, LEFT_ARCH_PANEL_YAW_RADIANS, 0)
);
const rightArchPanelWorldQuaternion = new Quaternion().setFromEuler(
  new Euler(0, RIGHT_ARCH_PANEL_YAW_RADIANS, 0)
);
const panelAnchorNormal = new Vector3();
const cameraWorldPosition = new Vector3();
const cameraToPanel = new Vector3();

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
    panel.quaternion.copy(
      isArchPanelAnchor(targets.panel.object.name)
        ? archPanelQuaternion(targets)
        : panelAnchorWorldQuaternion
    );
    camera.getWorldPosition(cameraWorldPosition);
    panelAnchorNormal
      .set(0, 0, 1)
      .applyQuaternion(panel.quaternion);
    cameraToPanel.copy(cameraWorldPosition).sub(panelAnchorWorldPosition);
    if (panelAnchorNormal.dot(cameraToPanel) < 0) {
      panelAnchorNormal.multiplyScalar(-1);
    }
    panel.position.addScaledVector(
      panelAnchorNormal,
      PANEL_ANCHOR_STANDOFF_METERS
    );
    return;
  }

  camera.add(panel);
  panel.position.set(0, PANEL_HEIGHT_OFFSET, PANEL_DISTANCE);
  panel.rotation.set(0, 0, 0);
}

function isArchPanelAnchor(name: string): boolean {
  return (
    name === "OpsPanelAnchor" ||
    name === "InfoPanelAnchor" ||
    name === "StatusPanelAnchor"
  );
}

function archPanelQuaternion(targets: PanelCompositionTargets): Quaternion {
  if (targets.panel.object?.name === "StatusPanelAnchor") {
    return statusPanelWorldQuaternion;
  }

  const statusX = statusPanelCenterX(targets.statusPanel);
  return panelAnchorWorldPosition.x < statusX
    ? leftArchPanelWorldQuaternion
    : rightArchPanelWorldQuaternion;
}

function statusPanelCenterX(statusPanel: PlacementTarget): number {
  if (statusPanel.object) {
    statusPanel.object.updateMatrixWorld(true);
    statusPanel.object.getWorldPosition(statusPanelWorldPosition);
    return statusPanelWorldPosition.x;
  }

  return statusPanel.position.x;
}
