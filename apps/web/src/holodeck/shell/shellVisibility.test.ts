import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { setShellVisualsVisible } from "./shellVisibility.js";

function renderableObject(name: string): Object3D {
  return Object.assign(new Object3D(), {
    name,
    isMesh: true
  });
}

describe("setShellVisualsVisible", () => {
  it("hides renderable shell objects without hiding exempt subtrees", () => {
    const root = new Object3D();
    const shellMesh = renderableObject("ShellMesh");
    const archRoot = new Object3D();
    const archMesh = renderableObject("ArchMesh");
    const generatedWorldRoot = new Object3D();
    const splatMesh = renderableObject("WorldSplat");

    archRoot.name = "Arch";
    archRoot.add(archMesh);
    generatedWorldRoot.name = "GeneratedWorldRoot";
    generatedWorldRoot.add(splatMesh);
    root.add(shellMesh);
    root.add(archRoot);
    root.add(generatedWorldRoot);

    setShellVisualsVisible(root, [generatedWorldRoot, archRoot], false);

    expect(root.visible).toBe(true);
    expect(shellMesh.visible).toBe(false);
    expect(archRoot.visible).toBe(true);
    expect(archMesh.visible).toBe(true);
    expect(generatedWorldRoot.visible).toBe(true);
    expect(splatMesh.visible).toBe(true);
  });

  it("restores hidden renderable shell objects", () => {
    const root = new Object3D();
    const shellMesh = renderableObject("ShellMesh");
    const generatedWorldRoot = new Object3D();

    shellMesh.visible = false;
    root.add(shellMesh);
    root.add(generatedWorldRoot);

    setShellVisualsVisible(root, [generatedWorldRoot], true);

    expect(shellMesh.visible).toBe(true);
  });
});
