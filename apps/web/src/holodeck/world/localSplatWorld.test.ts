import { describe, expect, it } from "vitest";
import { createLocalSplatWorld } from "./localSplatWorld.js";

describe("createLocalSplatWorld", () => {
  it("wraps a local SPZ URL as a renderable world", () => {
    expect(
      createLocalSplatWorld("/generated-worlds/world-123/full_res.spz")
    ).toMatchObject({
      worldId: "local-world-123-full-res",
      displayName: "Local splat world-123/full_res.spz",
      localSplat: {
        resolution: "local",
        sourceUrl: "/generated-worlds/world-123/full_res.spz",
        publicUrl: "/generated-worlds/world-123/full_res.spz"
      }
    });
  });
});
