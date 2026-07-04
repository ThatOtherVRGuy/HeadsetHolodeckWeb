import { describe, expect, it } from "vitest";
import {
  Euler,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import { placePanelForShellComposition } from "./panelPose.js";

describe("placePanelForShellComposition", () => {
  it("attaches the panel close to the camera so shell geometry cannot occlude it", () => {
    const panel = new PerspectiveCamera();
    const camera = new PerspectiveCamera();

    camera.position.set(2.05, 1.55, -5);
    placePanelForShellComposition(panel, camera, {
      statusPanel: {
        object: null,
        position: new Vector3(0, 1.29, -1.9),
        quaternion: new Quaternion()
      },
      generatedWorld: {
        object: null,
        position: new Vector3(2.55, 1.15, -6.2),
        quaternion: new Quaternion()
      }
    });

    expect(panel.parent).toBe(camera);
    expect(panel.position.toArray()).toEqual([0, -0.2, -0.75]);
    expect(panel.rotation.toArray()).toEqual([0, 0, 0, "XYZ"]);
  });

  it("uses the exported shell panel anchor without inheriting anchor tilt", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const panelAnchor = new Object3D();

    panelAnchor.name = "MainStatusPanelAnchor";
    panelAnchor.position.set(1, 1.4, -2);
    panelAnchor.quaternion.setFromEuler(new Euler(0.4, 0.7, -0.3));

    placePanelForShellComposition(panel, camera, {
      statusPanel: {
        object: panelAnchor,
        position: panelAnchor.position.clone(),
        quaternion: panelAnchor.quaternion.clone()
      },
      generatedWorld: {
        object: null,
        position: new Vector3(1, 1.1, -4),
        quaternion: new Quaternion()
      }
    });

    expect(panel.parent).not.toBe(camera);
    expect(panel.position.toArray()).toEqual([1, 1.4, -2]);
    expect(panel.rotation.x).toBeCloseTo(0);
    expect(panel.rotation.y).toBeCloseTo(0);
    expect(panel.rotation.z).toBeCloseTo(0);
  });
});
