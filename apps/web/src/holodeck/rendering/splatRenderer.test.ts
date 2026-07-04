import {
  Box3,
  Object3D,
  Scene,
  Vector3,
  WebGLRenderer
} from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it, vi } from "vitest";
import type { WorldResult } from "../world/worldResult";
import { selectSplatUrl, SplatRenderer } from "./splatRenderer.js";

function worldResult(overrides: Partial<WorldResult> = {}): WorldResult {
  return {
    worldId: "world-123",
    displayName: "Crystal Cave",
    prompt: "make a crystal cave",
    transcript: "Make a crystal cave.",
    panoUrl: "https://example.test/pano.jpg",
    spzUrls: {},
    raw: {},
    ...overrides
  };
}

describe("selectSplatUrl", () => {
  it("prefers a cached local splat URL", () => {
    expect(
      selectSplatUrl(
        worldResult({
          localSplat: {
            resolution: "full_res",
            sourceUrl: "https://example.test/full_res.spz",
            filePath: "/tmp/full_res.spz",
            publicUrl: "http://localhost:4817/generated-worlds/world/full_res.spz",
            byteLength: 3
          },
          spzUrls: {
            full_res: "https://remote.test/full_res.spz"
          }
        })
      )
    ).toBe("http://localhost:4817/generated-worlds/world/full_res.spz");
  });

  it("falls back through remote splat resolutions", () => {
    expect(
      selectSplatUrl(
        worldResult({
          spzUrls: {
            "100k": "https://remote.test/100k.spz",
            "500k": "https://remote.test/500k.spz"
          }
        })
      )
    ).toBe("https://remote.test/500k.spz");
  });
});

describe("SplatRenderer", () => {
  it("loads a hidden Spark splat mesh", async () => {
    const scene = new Scene();
    const renderer = new SplatRenderer(
      scene,
      {} as WebGLRenderer,
      createSparkTestConstructors()
    );

    await renderer.load(
      worldResult({
        spzUrls: {
          full_res: "https://remote.test/full_res.spz"
        }
      })
    );

    expect(scene.children).toHaveLength(2);
    expect(scene.children[0].name).toBe("HolodeckSparkRenderer");
    expect(scene.children[1].name).toBe("WorldSplat_world-123");
    expect(scene.children[1].visible).toBe(false);
    expect(scene.children[1].scale).toMatchObject({
      x: 0.6,
      y: -0.6,
      z: 0.6
    });
    expect(scene.children[1].position).toMatchObject({
      x: -3,
      y: 1.5,
      z: -0
    });

    renderer.show();
    expect(scene.children[1].visible).toBe(true);

    renderer.hide();
    expect(scene.children[1].visible).toBe(false);
  });

  it("disposes stale splats when overlapping loads resolve out of order", async () => {
    const scene = new Scene();
    const constructors = createSparkTestConstructors();
    const renderer = new SplatRenderer(scene, {} as WebGLRenderer, constructors);

    const firstLoad = renderer.load(
      worldResult({
        worldId: "slow",
        spzUrls: { full_res: "https://remote.test/slow.spz" }
      })
    );
    await renderer.load(
      worldResult({
        worldId: "fast",
        spzUrls: { full_res: "https://remote.test/fast.spz" }
      })
    );
    await firstLoad;

    const splats = scene.children.filter((child) =>
      child.name.startsWith("WorldSplat_")
    );
    expect(splats).toHaveLength(1);
    expect(splats[0].name).toBe("WorldSplat_fast");
    expect(constructors.disposedMeshes).toContain("https://remote.test/slow.spz");
  });
});

function createSparkTestConstructors() {
  const disposedMeshes: string[] = [];

  class FakeSparkRenderer extends Object3D {
    constructor() {
      super();
    }
  }

  class FakeSplatMesh extends Object3D {
    initialized: Promise<FakeSplatMesh>;
    url: string;
    numSplats = 12345;

    constructor(options: { url: string }) {
      super();
      this.url = options.url;
      this.initialized = Promise.resolve(this);
    }

    getBoundingBox() {
      return new Box3(new Vector3(0, -2.5, -2), new Vector3(10, 2.5, 2));
    }

    dispose() {
      disposedMeshes.push(this.url);
    }
  }

  return {
    SparkRendererCtor: FakeSparkRenderer as never,
    SplatMeshCtor: FakeSplatMesh as never,
    disposedMeshes
  };
}
