import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it, vi } from "vitest";
import { loadHolodeckShell } from "./shellLoader.js";

function shellWithRequiredAnchors() {
  const root = new Object3D();
  root.name = "HolodeckShell";
  for (const name of [
    "WorldRoot",
    "GeneratedWorldRoot",
    "OpsPanelAnchor",
    "InfoPanelAnchor",
    "StatusPanelAnchor",
    "UserStartPose"
  ]) {
    const anchor = new Object3D();
    anchor.name = name;
    root.add(anchor);
  }
  return root;
}

describe("loadHolodeckShell", () => {
  it("adds a loaded shell to the scene and resolves anchors", () => {
    const shell = shellWithRequiredAnchors();
    const createTransformEntity = vi.fn();

    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => shell,
      createTransformEntity
    });

    expect(result.status).toBe("loaded");
    expect(result.missingAnchors).toEqual([]);
    expect(result.root).toBe(shell);
    expect(result.placement.opsPanel.object?.name).toBe("OpsPanelAnchor");
    expect(result.placement.infoPanel.object?.name).toBe("InfoPanelAnchor");
    expect(result.placement.statusPanel.object?.name).toBe("StatusPanelAnchor");
    expect(createTransformEntity).toHaveBeenCalledWith(shell);
    expect(shell.matrixAutoUpdate).toBe(false);
  });

  it("falls back when the shell asset is unavailable", () => {
    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => null,
      createTransformEntity: vi.fn()
    });

    expect(result.status).toBe("missing-asset");
    expect(result.root).toBeNull();
    expect(result.placement.statusPanel.object).toBeNull();
    expect(result.message).toBe(
      "Holodeck shell asset holodeckShell was not loaded."
    );
  });

  it("loads the shell and reports missing anchors", () => {
    const shell = new Object3D();
    shell.name = "HolodeckShell";
    const worldRoot = new Object3D();
    worldRoot.name = "WorldRoot";
    shell.add(worldRoot);

    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => shell,
      createTransformEntity: vi.fn()
    });

    expect(result.status).toBe("missing-anchors");
    expect(result.missingAnchors).toEqual([
      "GeneratedWorldRoot",
      "OpsPanelAnchor",
      "InfoPanelAnchor",
      "StatusPanelAnchor",
      "UserStartPose"
    ]);
    expect(result.message).toContain("Missing holodeck shell anchors");
  });
});
