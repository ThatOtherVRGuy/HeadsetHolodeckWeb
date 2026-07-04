import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { REQUIRED_SHELL_ANCHORS } from "./anchorContract.js";
import { resolveShellAnchors } from "./anchorResolver.js";

function namedObject(name: string) {
  const object = new Object3D();
  object.name = name;
  return object;
}

describe("resolveShellAnchors", () => {
  it("resolves every required anchor from a loaded object tree", () => {
    const root = namedObject("HolodeckShell");
    for (const anchorName of REQUIRED_SHELL_ANCHORS) {
      root.add(namedObject(anchorName));
    }

    const result = resolveShellAnchors(root);

    expect(result.missing).toEqual([]);
    expect(Object.keys(result.anchors).sort()).toEqual(
      [...REQUIRED_SHELL_ANCHORS].sort()
    );
    expect(result.anchors.GeneratedWorldRoot?.name).toBe("GeneratedWorldRoot");
  });

  it("reports required anchors that are missing", () => {
    const root = namedObject("HolodeckShell");
    root.add(namedObject("WorldRoot"));
    root.add(namedObject("GeneratedWorldRoot"));

    const result = resolveShellAnchors(root);

    expect(result.anchors.WorldRoot?.name).toBe("WorldRoot");
    expect(result.missing).toEqual([
      "OpsPanelAnchor",
      "InfoPanelAnchor",
      "StatusPanelAnchor",
      "UserStartPose"
    ]);
  });

  it("finds anchors nested under exported geometry", () => {
    const root = namedObject("HolodeckShell");
    const arch = namedObject("Arch");
    const panelAnchor = namedObject("MainStatusPanelAnchor");
    arch.add(panelAnchor);
    root.add(arch);

    const result = resolveShellAnchors(root);

    expect(result.anchors.MainStatusPanelAnchor).toBe(panelAnchor);
  });

  it("resolves legacy panel anchors without requiring them", () => {
    const root = namedObject("HolodeckShell");
    const legacyStatus = namedObject("MainStatusPanelAnchor");
    const legacyRecord = namedObject("RecordControlAnchor");
    root.add(legacyStatus);
    root.add(legacyRecord);

    const result = resolveShellAnchors(root);

    expect(result.anchors.MainStatusPanelAnchor).toBe(legacyStatus);
    expect(result.anchors.RecordControlAnchor).toBe(legacyRecord);
    expect(result.missing).toContain("OpsPanelAnchor");
    expect(result.missing).not.toContain("MainStatusPanelAnchor");
  });
});
