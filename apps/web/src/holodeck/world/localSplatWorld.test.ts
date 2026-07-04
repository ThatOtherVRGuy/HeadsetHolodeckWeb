import { describe, expect, it } from "vitest";
import {
  createBrowserFileSplatWorld,
  createLocalSplatWorld
} from "./localSplatWorld.js";

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
        placement: "world",
        publicUrl: "/generated-worlds/world-123/full_res.spz"
      }
    });
  });
});

describe("createBrowserFileSplatWorld", () => {
  it("wraps a browser-selected SPZ file object URL as a renderable world", () => {
    expect(
      createBrowserFileSplatWorld(
        { name: "My Park.spz", size: 1234 },
        "blob:https://localhost:8081/file-123"
      )
    ).toMatchObject({
      worldId: "local-file-my-park",
      displayName: "Local splat My Park.spz",
      localSplat: {
        resolution: "local",
        sourceUrl: "blob:https://localhost:8081/file-123",
        filePath: "My Park.spz",
        placement: "loose-object",
        publicUrl: "blob:https://localhost:8081/file-123",
        byteLength: 1234
      },
      raw: {
        source: "browser-file-spz",
        fileName: "My Park.spz",
        objectUrl: "blob:https://localhost:8081/file-123"
      }
    });
  });
});
