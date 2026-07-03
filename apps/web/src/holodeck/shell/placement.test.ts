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
    const panelAnchor = namedObject(
      "MainStatusPanelAnchor",
      new Vector3(2, 3, 4)
    );
    const generatedWorldRoot = namedObject(
      "GeneratedWorldRoot",
      new Vector3(5, 6, 7)
    );

    const placement = createShellPlacement({
      MainStatusPanelAnchor: panelAnchor,
      GeneratedWorldRoot: generatedWorldRoot
    });

    expect(placement.statusPanel.object).toBe(panelAnchor);
    expect(placement.generatedWorld.object).toBe(generatedWorldRoot);
    expect(placement.statusPanel.position.toArray()).toEqual([2, 3, 4]);
    expect(placement.generatedWorld.position.toArray()).toEqual([5, 6, 7]);
  });

  it("uses debug fallbacks when anchors are unavailable", () => {
    const placement = createShellPlacement({});

    expect(placement.statusPanel.object).toBeNull();
    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.29, -1.9]);
    expect(placement.generatedWorld.object).toBeNull();
    expect(placement.generatedWorld.position.toArray()).toEqual([0, 1.2, 0]);
  });

  it("creates the current debug placements without a shell", () => {
    const placement = createDebugShellPlacement();

    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.29, -1.9]);
    expect(placement.recordControl.position.toArray()).toEqual([
      0.55,
      1.08,
      -1.85
    ]);
    expect(placement.userStart.position.toArray()).toEqual([-4, 1.5, -6]);
  });
});
