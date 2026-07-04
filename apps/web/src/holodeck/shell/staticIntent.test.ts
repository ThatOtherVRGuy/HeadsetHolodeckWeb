import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { freezeTransformStaticObjects } from "./staticIntent.js";

describe("freezeTransformStaticObjects", () => {
  it("freezes matrix updates recursively for a static shell tree", () => {
    const root = new Object3D();
    const child = new Object3D();
    const grandchild = new Object3D();
    child.add(grandchild);
    root.add(child);

    freezeTransformStaticObjects(root);

    expect(root.matrixAutoUpdate).toBe(false);
    expect(child.matrixAutoUpdate).toBe(false);
    expect(grandchild.matrixAutoUpdate).toBe(false);
  });

  it("updates matrices before disabling automatic updates", () => {
    const root = new Object3D();
    root.position.set(1, 2, 3);

    freezeTransformStaticObjects(root);

    expect(root.matrix.elements[12]).toBe(1);
    expect(root.matrix.elements[13]).toBe(2);
    expect(root.matrix.elements[14]).toBe(3);
  });
});
