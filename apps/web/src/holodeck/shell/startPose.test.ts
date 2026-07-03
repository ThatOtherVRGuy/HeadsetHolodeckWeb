import { describe, expect, it } from "vitest";
import {
  Object3D,
  Quaternion,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import {
  applyUserStartPose,
  HOLODECK_INITIAL_PLAYER_POSITION
} from "./startPose.js";

describe("applyUserStartPose", () => {
  it("uses the anchor as the XR player floor position and keeps camera height local", () => {
    const player = new Object3D();
    const camera = new Object3D();
    const generatedWorld = new Object3D();
    const target = new Vector3(2.55, 1.15, -6.2);

    player.add(camera);
    applyUserStartPose({
      player,
      camera,
      userStart: {
        object: null,
        position: new Vector3(2.55, 1.55, 1.25),
        quaternion: new Quaternion()
      },
      generatedWorld: {
        object: generatedWorld,
        position: target,
        quaternion: new Quaternion()
      }
    });

    expect(player.position.toArray()).toEqual([
      expect.closeTo(2.05),
      0,
      -5
    ]);
    expect([...HOLODECK_INITIAL_PLAYER_POSITION]).toEqual([2.05, 0, -5]);
    expect(camera.position.toArray()).toEqual([0, 1.55, 0]);

    const cameraWorldPosition = new Vector3();
    camera.getWorldPosition(cameraWorldPosition);
    expect(cameraWorldPosition.toArray()).toEqual([
      expect.closeTo(2.05),
      1.55,
      -5
    ]);
  });

  it("rotates the XR player toward the generated world on the floor plane", () => {
    const player = new Object3D();
    const camera = new Object3D();

    player.add(camera);
    applyUserStartPose({
      player,
      camera,
      userStart: {
        object: null,
        position: new Vector3(0, 1.6, 0),
        quaternion: new Quaternion()
      },
      generatedWorld: {
        object: null,
        position: new Vector3(-0.5, 1, 1),
        quaternion: new Quaternion()
      }
    });

    expect(Math.abs(player.rotation.y)).toBeCloseTo(Math.PI);
    expect(camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});
