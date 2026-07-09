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

  it("uses a side-facing orientation for arch panel anchors left of the status panel", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const shellRoot = new Object3D();
    const panelAnchor = new Object3D();
    const statusAnchor = new Object3D();

    camera.position.set(0, 1.5, 4);
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
    expect(panel.position.distanceTo(panelAnchor.getWorldPosition(new Vector3()))).toBeCloseTo(0.015);
    expect(panel.position.y).toBeCloseTo(1.4);
    expect(
      panel.quaternion.angleTo(
        new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0))
      )
    ).toBeCloseTo(0);
  });

  it("uses the opposite side-facing orientation for arch panel anchors right of the status panel", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const shellRoot = new Object3D();
    const panelAnchor = new Object3D();
    const statusAnchor = new Object3D();

    camera.position.set(0, 1.5, 4);
    shellRoot.position.set(-1.8, 0, 3);
    panelAnchor.name = "InfoPanelAnchor";
    panelAnchor.position.set(3, 1.4, -2);
    statusAnchor.name = "StatusPanelAnchor";
    statusAnchor.position.set(1, 1.8, -1);
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

    expect(
      panel.quaternion.angleTo(
        new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0))
      )
    ).toBeCloseTo(0);
  });

  it("keeps the status panel front-facing across the arch", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const shellRoot = new Object3D();
    const statusAnchor = new Object3D();

    camera.position.set(0, 1.5, 4);
    shellRoot.position.set(-1.8, 0, 3);
    statusAnchor.name = "StatusPanelAnchor";
    statusAnchor.position.set(1, 1.8, -1);
    shellRoot.add(statusAnchor);

    placePanelForShellComposition(panel, camera, {
      panel: {
        object: statusAnchor,
        position: statusAnchor.position.clone(),
        quaternion: statusAnchor.quaternion.clone()
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

    expect(
      panel.quaternion.angleTo(
        new Quaternion().setFromEuler(new Euler(0, Math.PI, 0))
      )
    ).toBeCloseTo(0);
  });

  it("keeps unknown panel anchor yaw unchanged", () => {
    const panel = new Object3D();
    const camera = new PerspectiveCamera();
    const shellRoot = new Object3D();
    const panelAnchor = new Object3D();

    camera.position.set(0, 1.5, 0);
    shellRoot.position.set(-1.8, 0, 3);
    panelAnchor.name = "DebugPanelAnchor";
    panelAnchor.position.set(1, 1.4, -2);
    panelAnchor.quaternion.setFromEuler(new Euler(0, -0.7, 0));
    shellRoot.add(panelAnchor);

    placePanelForShellComposition(panel, camera, {
      panel: {
        object: panelAnchor,
        position: panelAnchor.position.clone(),
        quaternion: panelAnchor.quaternion.clone()
      },
      statusPanel: {
        object: null,
        position: new Vector3(),
        quaternion: new Quaternion()
      },
      generatedWorld: {
        object: null,
        position: new Vector3(),
        quaternion: new Quaternion()
      }
    });

    expect(panel.rotation.y).toBeCloseTo(-0.7);
  });
});
