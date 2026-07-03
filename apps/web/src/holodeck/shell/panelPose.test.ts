import { describe, expect, it } from "vitest";
import {
  PerspectiveCamera,
  Quaternion,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import { placePanelInFrontOfCamera } from "./panelPose.js";

describe("placePanelInFrontOfCamera", () => {
  it("attaches the panel close to the camera so shell geometry cannot occlude it", () => {
    const panel = new PerspectiveCamera();
    const camera = new PerspectiveCamera();

    camera.position.set(2.05, 1.55, -5);
    placePanelInFrontOfCamera(panel, camera, {
      object: null,
      position: new Vector3(2.55, 1.15, -6.2),
      quaternion: new Quaternion()
    });

    expect(panel.parent).toBe(camera);
    expect(panel.position.toArray()).toEqual([0, -0.2, -0.75]);
    expect(panel.rotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
  });
});
