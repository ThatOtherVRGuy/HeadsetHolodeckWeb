import {
  Object3D,
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const PANEL_DISTANCE = -0.75;
const PANEL_HEIGHT_OFFSET = -0.2;

export function placePanelInFrontOfCamera(
  panel: Object3D,
  camera: Object3D,
  target: PlacementTarget
): void {
  camera.add(panel);
  panel.position.set(0, PANEL_HEIGHT_OFFSET, PANEL_DISTANCE);
  panel.rotation.set(0, 0, 0);
}
