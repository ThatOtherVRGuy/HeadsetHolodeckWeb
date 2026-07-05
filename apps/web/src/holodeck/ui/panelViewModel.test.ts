import { describe, expect, it } from "vitest";
import { buildPanelViewModel, formatPanelDuration } from "./panelViewModel";

describe("formatPanelDuration", () => {
  it("formats elapsed seconds as h:mm:ss", () => {
    expect(formatPanelDuration(0)).toBe("0:00:00");
    expect(formatPanelDuration(5_000)).toBe("0:00:05");
    expect(formatPanelDuration(65_000)).toBe("0:01:05");
    expect(formatPanelDuration(3_665_000)).toBe("1:01:05");
  });
});

describe("buildPanelViewModel", () => {
  it("shows idle no-world panel state", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Idle",
        errorMessage: "",
        statusMessage: ""
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 12_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Record");
    expect(view.ops.mode).toBe("IDLE");
    expect(view.ops.modelLabel).toBe("Model: Marble 1.1");
    expect(view.info.title).toBe("NO WORLD LOADED");
    expect(view.info.source).toBe("SOURCE STATIC SHELL");
    expect(view.status.mode).toBe("READY");
    expect(view.status.message).toBe("Holodeck systems standing by.");
    expect(view.status.health).toMatch(/RUN 0:00:12  WORLD --:--:--$/);
  });

  it("shows recording state as generate-ready", () => {
    const view = buildPanelViewModel({
      state: {
        current: "ListeningForCommand",
        errorMessage: "",
        statusMessage: "Listening for world prompt."
      },
      isRecording: true,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 22_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Generate");
    expect(view.ops.mode).toBe("REC");
    expect(view.ops.detail).toBe("Listening for world prompt.");
    expect(view.status.mode).toBe("REC");
    expect(view.status.level).toBe("info");
  });

  it("shows generation progress and transcript", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Generating",
        errorMessage: "",
        statusMessage: "Constructing scene. Poll 3, 15s"
      },
      isRecording: false,
      isGenerating: true,
      selectedModelLabel: "Marble 1.1",
      transcript: "a large autumn park",
      rendererLabel: "Splat",
      appElapsedMs: 42_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Busy");
    expect(view.ops.mode).toBe("GEN");
    expect(view.info.title).toBe("GENERATING WORLD");
    expect(view.info.transcript).toBe("PROMPT a large autumn park");
    expect(view.info.renderer).toBe("RENDERER Splat");
    expect(view.status.mode).toBe("GEN");
    expect(view.status.message).toBe("Constructing scene. Poll 3, 15s");
  });

  it("shows local splat ready details", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Ready",
        errorMessage: "",
        statusMessage: "Local splat ready: park/full_res.spz"
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "Splat",
      loadedWorld: {
        title: "park/full_res.spz",
        source: "LOCAL SPZ",
        assetLabel: "park/full_res.spz"
      },
      appElapsedMs: 90_000,
      worldElapsedMs: 8_000
    });

    expect(view.info.title).toBe("park/full_res.spz");
    expect(view.info.source).toBe("SOURCE LOCAL SPZ");
    expect(view.info.asset).toBe("ASSET park/full_res.spz");
    expect(view.status.mode).toBe("READY");
    expect(view.status.level).toBe("success");
    expect(view.status.health).toMatch(/RUN 0:01:30  WORLD 0:00:08$/);
  });

  it("surfaces errors across all panels", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Error",
        errorMessage: "World generation failed",
        statusMessage: ""
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 5_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Record");
    expect(view.ops.mode).toBe("ERROR");
    expect(view.info.detail).toBe("ERROR: World generation failed");
    expect(view.status.mode).toBe("ERROR");
    expect(view.status.message).toBe("World generation failed");
    expect(view.status.level).toBe("error");
  });
});
