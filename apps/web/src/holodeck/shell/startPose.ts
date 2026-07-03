import {
  Object3D,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import type { PlacementTarget } from "./placement.js";

const USER_START_OFFSET = new Vector3(-0.5, 0, -6.25);

export const HOLODECK_INITIAL_PLAYER_POSITION = [2.05, 0, -5] as const;

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
    USER_START_OFFSET
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
  options.player.rotation.set(
    0,
    playerYawToward(playerPosition, options.generatedWorld.position),
    0
  );
  options.camera.position.copy(
    cameraLocalPositionFromUserStart(options.userStart)
  );
  options.camera.quaternion.identity();
  options.player.updateMatrixWorld(true);
}

function playerYawToward(position: Vector3, target: Vector3): number {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5) {
    return 0;
  }

  return Math.atan2(-dx, -dz);
}
