import { describe, expect, it } from "vitest";
import {
  normalizeWorld,
  normalizeWorldPage,
  normalizeWorldSummary
} from "./normalizeWorld.js";

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

it("normalizes a WorldLabs list item into a browser summary", () => {
  expect(
    normalizeWorldSummary({
      world_id: "world-123",
      display_name: "Autumn Park",
      model: "Marble 0.1-plus",
      status: "SUCCEEDED",
      created_at: "2026-07-05T10:00:00Z",
      updated_at: "2026-07-05T10:05:00Z",
      world_prompt: {
        type: "text",
        text_prompt: "a park in autumn"
      },
      assets: {
        thumbnail_url: "https://example.test/thumb.jpg",
        imagery: { pano_url: "https://example.test/pano.jpg" },
        splats: {
          spz_urls: {
            full_res: "https://example.test/full_res.spz"
          }
        }
      }
    })
  ).toEqual({
    worldId: "world-123",
    displayName: "Autumn Park",
    model: "Marble 0.1-plus",
    status: "SUCCEEDED",
    createdAt: "2026-07-05T10:00:00Z",
    updatedAt: "2026-07-05T10:05:00Z",
    thumbnailUrl: "https://example.test/thumb.jpg",
    prompt: "a park in autumn",
    hasPanorama: true,
    hasSplat: true
  });
});

it("normalizes a WorldLabs page and filters invalid world ids", () => {
  expect(
    normalizeWorldPage(
      {
        worlds: [
          { world_id: "world-123", display_name: "Valid World" },
          { display_name: "Missing ID" }
        ],
        next_page_token: "token-2"
      },
      { pageSize: 20, pageToken: "token-1" }
    )
  ).toEqual({
    worlds: [
      {
        worldId: "world-123",
        displayName: "Valid World",
        model: "",
        status: "",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "",
        hasPanorama: false,
        hasSplat: false
      }
    ],
    nextPageToken: "token-2",
    pageSize: 20,
    pageToken: "token-1"
  });
});

it("filters malformed page worlds and trims the echoed request page token", () => {
  expect(
    normalizeWorldPage(
      {
        worlds: [
          null,
          undefined,
          "not-an-object" as unknown as never,
          { world_id: "   " },
          { world_id: "world-123", display_name: "Valid World" },
          { world_id: "world-456", display_name: "Second Valid" }
        ],
        next_page_token: " token-2 "
      },
      { pageSize: 20, pageToken: " token-1 " }
    )
  ).toEqual({
    worlds: [
      {
        worldId: "world-123",
        displayName: "Valid World",
        model: "",
        status: "",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "",
        hasPanorama: false,
        hasSplat: false
      },
      {
        worldId: "world-456",
        displayName: "Second Valid",
        model: "",
        status: "",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "",
        hasPanorama: false,
        hasSplat: false
      }
    ],
    nextPageToken: "token-2",
    pageSize: 20,
    pageToken: "token-1"
  });
});

it("treats non-array page worlds as an empty list", () => {
  expect(
    normalizeWorldPage(
      {
        worlds: "oops" as unknown as never,
        next_page_token: " next-token "
      },
      { pageSize: 10, pageToken: " request-token " }
    )
  ).toEqual({
    worlds: [],
    nextPageToken: "next-token",
    pageSize: 10,
    pageToken: "request-token"
  });
});

it("keeps incomplete worlds visible but not renderable", () => {
  expect(
    normalizeWorldSummary({
      world_id: "world-pending",
      display_name: "Pending World",
      status: "RUNNING",
      assets: {}
    })
  ).toMatchObject({
    worldId: "world-pending",
    hasPanorama: false,
    hasSplat: false
  });
});
