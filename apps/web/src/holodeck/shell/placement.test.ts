import { Object3D, Vector3 } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import {
  createDebugShellPlacement,
  createShellPlacement
} from "./placement.js";

function namedObject(name: string, position: Vector3) {
  const object = new Object3D();
  object.name = name;
  object.position.copy(position);
  return object;
}

describe("createShellPlacement", () => {
  it("uses exported anchors when they are present", () => {
    const opsPanel = namedObject("OpsPanelAnchor", new Vector3(1, 2, 3));
    const infoPanel = namedObject("InfoPanelAnchor", new Vector3(2, 3, 4));
    const statusPanel = namedObject("StatusPanelAnchor", new Vector3(3, 4, 5));
    const generatedWorldRoot = namedObject(
      "GeneratedWorldRoot",
      new Vector3(5, 6, 7)
    );

    const placement = createShellPlacement({
      OpsPanelAnchor: opsPanel,
      InfoPanelAnchor: infoPanel,
      StatusPanelAnchor: statusPanel,
      GeneratedWorldRoot: generatedWorldRoot
    });

    expect(placement.opsPanel.object).toBe(opsPanel);
    expect(placement.infoPanel.object).toBe(infoPanel);
    expect(placement.statusPanel.object).toBe(statusPanel);
    expect(placement.generatedWorld.object).toBe(generatedWorldRoot);
    expect(placement.opsPanel.position.toArray()).toEqual([1, 2, 3]);
    expect(placement.infoPanel.position.toArray()).toEqual([2, 3, 4]);
    expect(placement.statusPanel.position.toArray()).toEqual([3, 4, 5]);
    expect(placement.generatedWorld.position.toArray()).toEqual([5, 6, 7]);
  });

  it("falls back to legacy panel anchors while older shell exports are loaded", () => {
    const legacyStatus = namedObject(
      "MainStatusPanelAnchor",
      new Vector3(2, 3, 4)
    );
    const legacyRecord = namedObject(
      "RecordControlAnchor",
      new Vector3(6, 7, 8)
    );

    const placement = createShellPlacement({
      MainStatusPanelAnchor: legacyStatus,
      RecordControlAnchor: legacyRecord
    });

    expect(placement.statusPanel.object).toBe(legacyStatus);
    expect(placement.opsPanel.object).toBe(legacyRecord);
    expect(placement.recordControl.object).toBe(legacyRecord);
  });

  it("uses debug fallbacks when anchors are unavailable", () => {
    const placement = createShellPlacement({});

    expect(placement.statusPanel.object).toBeNull();
    expect(placement.opsPanel.position.toArray()).toEqual([-0.72, 1.12, -1.85]);
    expect(placement.infoPanel.position.toArray()).toEqual([0.72, 1.12, -1.85]);
    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.55, -1.9]);
    expect(placement.generatedWorld.object).toBeNull();
    expect(placement.generatedWorld.position.toArray()).toEqual([0, 1.2, 0]);
  });

  it("creates the current debug placements without a shell", () => {
    const placement = createDebugShellPlacement();

    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.55, -1.9]);
    expect(placement.recordControl.position.toArray()).toEqual([
      -0.72,
      1.12,
      -1.85
    ]);
    expect(placement.userStart.position.toArray()).toEqual([-4, 1.5, -6]);
  });
});
