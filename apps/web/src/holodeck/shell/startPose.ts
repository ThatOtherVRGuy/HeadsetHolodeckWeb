import {
  Object3D,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const ARCH_VIEW_OFFSET = new Vector3(0.4, 0, -2.35);
const ARCH_VIEW_YAW = Math.PI;

export const HOLODECK_INITIAL_PLAYER_POSITION = [2.95, 0, -1.1] as const;

export interface ApplyUserStartPoseOptions {
  player: Object3D;
  camera: Object3D;
  userStart: PlacementTarget;
  generatedWorld: PlacementTarget;
}

export function playerFloorPositionFromUserStart(
  userStart: PlacementTarget
): Vector3 {
  return new Vector3(userStart.position.x, 0, userStart.position.z).add(
    ARCH_VIEW_OFFSET
  );
}

export function cameraLocalPositionFromUserStart(
  userStart: PlacementTarget
): Vector3 {
  return new Vector3(0, Math.max(0, userStart.position.y), 0);
}

export function applyUserStartPose(options: ApplyUserStartPoseOptions): void {
  const playerPosition = playerFloorPositionFromUserStart(options.userStart);
  options.player.position.copy(playerPosition);
  options.player.rotation.set(0, ARCH_VIEW_YAW, 0);
  options.camera.position.copy(
    cameraLocalPositionFromUserStart(options.userStart)
  );
  options.camera.quaternion.identity();
  options.player.updateMatrixWorld(true);
}
