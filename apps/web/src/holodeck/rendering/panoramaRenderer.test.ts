import {
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  Texture
} from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it, vi } from "vitest";
import { PanoramaRenderer } from "./panoramaRenderer.js";

function worldResult(overrides: Partial<{ worldId: string; panoUrl: string }> = {}) {
  return {
    worldId: overrides.worldId ?? "world-123",
    displayName: "Crystal Cave",
    prompt: "make a crystal cave",
    transcript: "Make a crystal cave.",
    panoUrl: overrides.panoUrl ?? "https://example.test/pano.jpg",
    spzUrls: {},
    raw: {}
  };
}

describe("PanoramaRenderer", () => {
  it("loads a hidden panorama sphere from the world panorama URL", async () => {
    const scene = new Scene();
    const texture = new Texture();
    const loadTexture = vi.fn().mockResolvedValue(texture);
    const renderer = new PanoramaRenderer(scene, { loadTexture });

    await renderer.load(worldResult());

    expect(loadTexture).toHaveBeenCalledWith("https://example.test/pano.jpg");
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as Mesh<SphereGeometry, MeshBasicMaterial>;
    expect(mesh.name).toBe("WorldPanorama_world-123");
    expect(mesh.visible).toBe(false);
    expect(mesh.geometry).toBeInstanceOf(SphereGeometry);
    expect(mesh.material.side).toBe(FrontSide);
    expect(mesh.material.map).toBe(texture);
  });

  it("shows and hides the loaded panorama", async () => {
    const scene = new Scene();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi.fn().mockResolvedValue(new Texture())
    });

    await renderer.load(worldResult());
    renderer.show();

    expect(scene.children[0].visible).toBe(true);

    renderer.hide();

    expect(scene.children[0].visible).toBe(false);
  });

  it("replaces an existing panorama when loading another world", async () => {
    const scene = new Scene();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi
        .fn()
        .mockResolvedValueOnce(new Texture())
        .mockResolvedValueOnce(new Texture())
    });

    await renderer.load(worldResult({ worldId: "first" }));
    const firstMesh = scene.children[0];
    await renderer.load(worldResult({ worldId: "second" }));

    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).not.toBe(firstMesh);
    expect(scene.children[0].name).toBe("WorldPanorama_second");
  });

  it("keeps the newest panorama when overlapping loads resolve out of order", async () => {
    const scene = new Scene();
    let resolveFirst!: (texture: Texture) => void;
    const firstTexture = new Texture();
    const secondTexture = new Texture();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi
        .fn()
        .mockReturnValueOnce(
          new Promise<Texture>((resolve) => {
            resolveFirst = resolve;
          })
        )
        .mockResolvedValueOnce(secondTexture)
    });

    const firstLoad = renderer.load(worldResult({ worldId: "slow-first" }));
    await renderer.load(worldResult({ worldId: "fast-second" }));
    resolveFirst(firstTexture);
    await firstLoad;

    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].name).toBe("WorldPanorama_fast-second");
  });

  it("does not add a panorama after being disposed while loading", async () => {
    const scene = new Scene();
    let resolveTexture!: (texture: Texture) => void;
    const texture = new Texture();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi.fn().mockReturnValue(
        new Promise<Texture>((resolve) => {
          resolveTexture = resolve;
        })
      )
    });
    const textureDispose = vi.spyOn(texture, "dispose");

    const load = renderer.load(worldResult());
    renderer.dispose();
    resolveTexture(texture);
    await load;

    expect(scene.children).toHaveLength(0);
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it("ignores stale load failures after a newer load starts", async () => {
    const scene = new Scene();
    let rejectFirst!: (error: Error) => void;
    const secondTexture = new Texture();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi
        .fn()
        .mockReturnValueOnce(
          new Promise<Texture>((_, reject) => {
            rejectFirst = reject;
          })
        )
        .mockResolvedValueOnce(secondTexture)
    });

    const firstLoad = renderer.load(worldResult({ worldId: "stale" }));
    await renderer.load(worldResult({ worldId: "current" }));
    rejectFirst(new Error("stale texture failed"));

    await expect(firstLoad).resolves.toBeUndefined();
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].name).toBe("WorldPanorama_current");
  });

  it("removes and disposes the loaded panorama", async () => {
    const scene = new Scene();
    const texture = new Texture();
    const renderer = new PanoramaRenderer(scene, {
      loadTexture: vi.fn().mockResolvedValue(texture)
    });

    await renderer.load(worldResult());
    const mesh = scene.children[0] as Mesh<SphereGeometry, MeshBasicMaterial>;
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(mesh.material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    renderer.dispose();

    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
