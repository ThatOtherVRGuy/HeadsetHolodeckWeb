import { describe, expect, it, vi } from "vitest";
import type { WorldResult } from "../world/worldResult";
import { PreferredWorldRenderer } from "./preferredWorldRenderer.js";
import type { WorldRenderer } from "./worldRenderer";

function worldResult(): WorldResult {
  return {
    worldId: "world-123",
    displayName: "Crystal Cave",
    prompt: "make a crystal cave",
    transcript: "Make a crystal cave.",
    panoUrl: "https://example.test/pano.jpg",
    spzUrls: {},
    raw: {}
  };
}

describe("PreferredWorldRenderer", () => {
  it("shows the preferred renderer when it loads successfully", async () => {
    const preferred = createRenderer();
    const fallback = createRenderer();
    const renderer = new PreferredWorldRenderer(preferred, fallback);

    await renderer.load(worldResult());
    renderer.show();

    expect(preferred.load).toHaveBeenCalledOnce();
    expect(fallback.load).not.toHaveBeenCalled();
    expect(preferred.show).toHaveBeenCalledOnce();
  });

  it("loads and shows the fallback renderer when preferred loading fails", async () => {
    const preferred = createRenderer({
      load: vi.fn().mockRejectedValue(new Error("splat failed"))
    });
    const fallback = createRenderer();
    const renderer = new PreferredWorldRenderer(preferred, fallback);

    await renderer.load(worldResult());
    renderer.show();

    expect(fallback.load).toHaveBeenCalledOnce();
    expect(fallback.show).toHaveBeenCalledOnce();
  });
});

function createRenderer(
  overrides: Partial<WorldRenderer> = {}
): WorldRenderer {
  return {
    mode: "panorama",
    load: vi.fn().mockResolvedValue(undefined),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    ...overrides
  };
}
