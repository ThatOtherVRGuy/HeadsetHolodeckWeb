import {
  Object3D,
  Vector2,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";

const WORLD_UP = new Vector3(0, 1, 0);
const DEFAULT_FORWARD = new Vector3(0, 0, -1);
const cameraForward = new Vector3();
const cameraRight = new Vector3();

export function cameraRelativeMovement(
  inputAxis: Vector2,
  camera: Object3D,
  out: Vector3
): Vector3 {
  if (inputAxis.lengthSq() <= 0.0001) {
    return out.set(0, 0, 0);
  }

  const inputMagnitude = Math.min(inputAxis.length(), 1);
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;

  if (cameraForward.lengthSq() <= 0.0001) {
    cameraForward.copy(DEFAULT_FORWARD);
  } else {
    cameraForward.normalize();
  }

  cameraRight.crossVectors(cameraForward, WORLD_UP).normalize();

  out
    .copy(cameraRight)
    .multiplyScalar(inputAxis.x)
    .addScaledVector(cameraForward, -inputAxis.y);

  if (out.lengthSq() <= 0.0001) {
    return out.set(0, 0, 0);
  }

  return out.normalize().multiplyScalar(inputMagnitude);
}
