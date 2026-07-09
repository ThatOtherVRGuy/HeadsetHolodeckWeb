import { describe, expect, it } from "vitest";
import {
  Euler,
  Object3D
} from "@iwsdk/core/dist/runtime/three.js";
import {
  createHolodeckComposeController,
  isHolodeckComposeModeEnabled
} from "./composeMode.js";

describe("isHolodeckComposeModeEnabled", () => {
  it("enables compose mode from the compose query parameter", () => {
    expect(isHolodeckComposeModeEnabled("?compose=1")).toBe(true);
    expect(isHolodeckComposeModeEnabled("?compose=true")).toBe(true);
    expect(isHolodeckComposeModeEnabled("?localSplat=test.spz")).toBe(false);
  });
});

describe("createHolodeckComposeController", () => {
  it("lists panel and spawn transforms", () => {
    const opsPanel = new Object3D();
    const spawn = new Object3D();

    opsPanel.position.set(1, 2, 3);
    opsPanel.rotation.set(0, Math.PI, 0);
    spawn.position.set(-1, 0, 4);

    const compose = createHolodeckComposeController([
      { name: "opsPanel", object: opsPanel, kind: "panel" },
      { name: "spawn", object: spawn, kind: "spawn" }
    ]);

    expect(compose.list()).toEqual([
      {
        name: "opsPanel",
        kind: "panel",
        position: [1, 2, 3],
        rotationDegrees: [0, 180, 0],
        scale: [1, 1, 1]
      },
      {
        name: "spawn",
        kind: "spawn",
        position: [-1, 0, 4],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1]
      }
    ]);
  });

  it("nudges, rotates, and scales registered targets", () => {
    const infoPanel = new Object3D();
    const compose = createHolodeckComposeController([
      { name: "infoPanel", object: infoPanel, kind: "panel" }
    ]);

    compose.nudge("infoPanel", 0.1, -0.2, 0.3);
    compose.rotate("infoPanel", 0, 45, 0);
    compose.scale("infoPanel", 1.5);

    expect(infoPanel.position.toArray()).toEqual([0.1, -0.2, 0.3]);
    expect(infoPanel.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(infoPanel.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
  });

  it("sets transforms and snapshots them as JSON-friendly data", () => {
    const statusPanel = new Object3D();
    const compose = createHolodeckComposeController([
      { name: "statusPanel", object: statusPanel, kind: "panel" }
    ]);

    compose.set("statusPanel", {
      position: [0.25, 1.75, -0.5],
      rotationDegrees: [0, 90, 0],
      scale: [1.1, 1.2, 1.3]
    });

    expect(statusPanel.position.toArray()).toEqual([0.25, 1.75, -0.5]);
    expect(statusPanel.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(statusPanel.scale.toArray()).toEqual([1.1, 1.2, 1.3]);
    expect(compose.snapshot()).toEqual({
      version: 1,
      targets: {
        statusPanel: {
          kind: "panel",
          position: [0.25, 1.75, -0.5],
          rotationDegrees: [0, 90, 0],
          scale: [1.1, 1.2, 1.3]
        }
      }
    });
  });

  it("throws a useful error for unknown targets", () => {
    const compose = createHolodeckComposeController([]);

    expect(() => compose.nudge("missing", 1, 0, 0)).toThrow(
      "Unknown compose target missing."
    );
  });
});
