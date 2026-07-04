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
      panel: {
        object: null,
        position: new Vector3(0, 1.55, -1.9),
        quaternion: new Quaternion()
      },
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

  it("uses the exported shell panel anchor world transform", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const shellRoot = new Object3D();
    const panelAnchor = new Object3D();
    const statusAnchor = new Object3D();

    shellRoot.position.set(-1.8, 0, 3);
    panelAnchor.name = "OpsPanelAnchor";
    panelAnchor.position.set(1, 1.4, -2);
    panelAnchor.quaternion.setFromEuler(new Euler(0, 0.7, 0));
    statusAnchor.name = "StatusPanelAnchor";
    statusAnchor.position.set(3, 1.8, -1);
    shellRoot.add(panelAnchor);
    shellRoot.add(statusAnchor);

    placePanelForShellComposition(panel, camera, {
      panel: {
        object: panelAnchor,
        position: panelAnchor.position.clone(),
        quaternion: panelAnchor.quaternion.clone()
      },
      statusPanel: {
        object: statusAnchor,
        position: statusAnchor.position.clone(),
        quaternion: statusAnchor.quaternion.clone()
      },
      generatedWorld: {
        object: null,
        position: new Vector3(1, 1.1, -4),
        quaternion: new Quaternion()
      }
    });

    expect(panel.parent).toBeNull();
    expect(panel.position.toArray()).toEqual([
      expect.closeTo(-0.8),
      1.4,
      1
    ]);
    expect(panel.rotation.x).toBeCloseTo(0);
    expect(panel.rotation.y).toBeCloseTo(0.7);
    expect(panel.rotation.z).toBeCloseTo(0);
  });
});
