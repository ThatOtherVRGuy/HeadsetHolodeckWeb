import { describe, expect, it } from "vitest";
import { normalizeWorld } from "./normalizeWorld.js";

describe("normalizeWorld", () => {
  it("normalizes a World Labs world result into the server result shape", () => {
    const world = {
      world_id: " world-123 ",
      display_name: " Neon Atrium ",
      assets: {
        thumbnail_url: "https://example.test/thumb.jpg",
        imagery: {
          pano_url: " https://example.test/pano.jpg "
        },
        splats: {
          spz_urls: {
            "100k": "https://example.test/100k.spz",
            "500k": "https://example.test/500k.spz"
          }
        },
        mesh: {
          collider_mesh_url: "https://example.test/collider.glb"
        }
      }
    };

    expect(
      normalizeWorld(world, {
        prompt: "make a neon atrium",
        transcript: "Make a neon atrium."
      })
    ).toEqual({
      worldId: "world-123",
      displayName: "Neon Atrium",
      prompt: "make a neon atrium",
      transcript: "Make a neon atrium.",
      panoUrl: "https://example.test/pano.jpg",
      thumbnailUrl: "https://example.test/thumb.jpg",
      spzUrls: {
        "100k": "https://example.test/100k.spz",
        "500k": "https://example.test/500k.spz"
      },
      meshUrl: "https://example.test/collider.glb",
      raw: world
    });
  });

  it("throws when the World Labs world result does not include a panorama URL", () => {
    expect(() =>
      normalizeWorld(
        {
          world_id: "world-123",
          assets: {
            imagery: {}
          }
        },
        {
          prompt: "make a neon atrium",
          transcript: "Make a neon atrium."
        }
      )
    ).toThrow("World Labs result did not include a panorama URL");
  });
});
