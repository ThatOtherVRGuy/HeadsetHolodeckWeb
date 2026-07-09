import { describe, expect, it } from "vitest";
import {
  PerspectiveCamera,
  Vector2,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import { cameraRelativeMovement } from "./cameraRelativeMovement.js";

describe("cameraRelativeMovement", () => {
  it("moves W along the camera's forward direction", () => {
    const camera = new PerspectiveCamera();
    const movement = cameraRelativeMovement(
      new Vector2(0, -1),
      camera,
      new Vector3()
    );

    expect(movement.x).toBeCloseTo(0);
    expect(movement.y).toBeCloseTo(0);
    expect(movement.z).toBeCloseTo(-1);
  });

  it("moves D along the camera's right direction", () => {
    const camera = new PerspectiveCamera();
    const movement = cameraRelativeMovement(
      new Vector2(1, 0),
      camera,
      new Vector3()
    );

    expect(movement.x).toBeCloseTo(1);
    expect(movement.y).toBeCloseTo(0);
    expect(movement.z).toBeCloseTo(0);
  });

  it("uses camera yaw rather than world axes", () => {
    const camera = new PerspectiveCamera();
    camera.rotation.set(0, Math.PI / 2, 0);
    camera.updateMatrixWorld(true);

    const movement = cameraRelativeMovement(
      new Vector2(0, -1),
      camera,
      new Vector3()
    );

    expect(movement.x).toBeCloseTo(-1);
    expect(movement.y).toBeCloseTo(0);
    expect(movement.z).toBeCloseTo(0);
  });
});
