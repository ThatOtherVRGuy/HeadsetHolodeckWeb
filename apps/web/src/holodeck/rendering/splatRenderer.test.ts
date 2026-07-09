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
      x: 4.8,
      y: -4.8,
      z: 4.8
    });
    expect(scene.children[1].position).toMatchObject({
      x: -24,
      y: 12,
      z: -0
    });

    renderer.show();
    expect(scene.children[1].visible).toBe(true);

    renderer.hide();
    expect(scene.children[1].visible).toBe(false);
  });

  it("uses smaller object-preview framing for browser-picked loose splats", async () => {
    const scene = new Scene();
    const renderer = new SplatRenderer(
      scene,
      {} as WebGLRenderer,
      createSparkTestConstructors()
    );

    await renderer.load(
      worldResult({
        worldId: "loose",
        localSplat: {
          resolution: "local",
          sourceUrl: "blob:https://localhost:8081/loose",
          filePath: "loose.spz",
          placement: "loose-object",
          publicUrl: "blob:https://localhost:8081/loose",
          byteLength: 1234
        },
        raw: {}
      })
    );

    expect(scene.children[1].scale).toMatchObject({
      x: 1.6,
      y: -1.6,
      z: 1.6
    });
    expect(scene.children[1].position).toMatchObject({
      x: -8,
      y: 1.2,
      z: -0
    });
  });

  it("passes the associated world to progress and loaded status callbacks", async () => {
    const scene = new Scene();
    const onStatus = vi.fn();
    const renderer = new SplatRenderer(
      scene,
      {} as WebGLRenderer,
      {
        ...createSparkTestConstructors(),
        onStatus
      }
    );
    const world = worldResult({
      worldId: "local-world",
      localSplat: {
        resolution: "full_res",
        sourceUrl: "https://example.test/full_res.spz",
        filePath: "/tmp/full_res.spz",
        publicUrl: "http://localhost:4817/generated-worlds/local/full_res.spz",
        byteLength: 100
      }
    });

    await renderer.load(world);

    expect(onStatus).toHaveBeenCalledWith("Loading local splat 50%", world);
    expect(onStatus).toHaveBeenCalledWith(
      "Local splat decoded: 12,345 splats",
      world
    );
  });

  it("keeps the default scale when Spark reports unusable bounds", async () => {
    const scene = new Scene();
    const constructors = createSparkTestConstructors({
      bounds: new Box3()
    });
    const renderer = new SplatRenderer(scene, {} as WebGLRenderer, constructors);

    await renderer.load(
      worldResult({
        spzUrls: {
          full_res: "https://remote.test/empty-bounds.spz"
        }
      })
    );

    expect(scene.children[1].scale).toMatchObject({
      x: 8,
      y: -8,
      z: 8
    });
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

function createSparkTestConstructors(options: {
  bounds?: Box3;
} = {}) {
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

    constructor(options: { url: string; onProgress?: (event: ProgressEvent) => void }) {
      super();
      this.url = options.url;
      options.onProgress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100
      } as ProgressEvent);
      this.initialized = Promise.resolve(this);
    }

    getBoundingBox() {
      return options.bounds ?? new Box3(
        new Vector3(0, -2.5, -2),
        new Vector3(10, 2.5, 2)
      );
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
