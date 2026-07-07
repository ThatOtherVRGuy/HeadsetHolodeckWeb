import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

describe("WorldLabs world browser routes", () => {
  it("lists worlds through the local server and passes pageSize/pageToken/signal", async () => {
    const listWorlds = vi.fn<WorldLabsClient["listWorlds"]>().mockResolvedValue({
      worlds: [],
      pageSize: 10,
      pageToken: "token-1",
      nextPageToken: "next-token"
    });
    const app = await buildServer({
      worldLabsWorlds: {
        worldLabsClient: {
          listWorlds,
          getWorld: vi.fn(),
          deleteWorld: vi.fn()
        }
      }
    } as any);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/worldlabs/worlds?pageSize=10&pageToken=token-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ nextPageToken: "next-token" });
      expect(listWorlds).toHaveBeenCalledWith({
        pageSize: 10,
        pageToken: "token-1",
        signal: expect.any(AbortSignal)
      });
    } finally {
      await app.close();
    }
  });

  it("gets a selected world and passes worldId/signal", async () => {
    const getWorld = vi.fn<WorldLabsClient["getWorld"]>().mockResolvedValue({
      worldId: "world-123",
      displayName: "Park",
      prompt: "a park",
      transcript: "a park",
      panoUrl: "https://example.test/pano.jpg",
      spzUrls: {},
      raw: { world_id: "world-123" }
    });
    const app = await buildServer({
      worldLabsWorlds: {
        worldLabsClient: {
          listWorlds: vi.fn(),
          getWorld,
          deleteWorld: vi.fn()
        }
      }
    } as any);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/worldlabs/worlds/world-123"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ worldId: "world-123" });
      expect(getWorld).toHaveBeenCalledWith(
        "world-123",
        expect.any(AbortSignal)
      );
    } finally {
      await app.close();
    }
  });

  it("deletes a selected world and passes worldId/signal", async () => {
    const deleteWorld = vi.fn<WorldLabsClient["deleteWorld"]>().mockResolvedValue(
      {
        worldId: "world-123",
        deleted: true
      }
    );
    const app = await buildServer({
      worldLabsWorlds: {
        worldLabsClient: {
          listWorlds: vi.fn(),
          getWorld: vi.fn(),
          deleteWorld
        }
      }
    } as any);

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/worldlabs/worlds/world-123"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        worldId: "world-123",
        deleted: true
      });
      expect(deleteWorld).toHaveBeenCalledWith(
        "world-123",
        expect.any(AbortSignal)
      );
    } finally {
      await app.close();
    }
  });

  it("rejects unsafe world ids for delete", async () => {
    const app = await buildServer({
      worldLabsWorlds: {
        worldLabsClient: {
          listWorlds: vi.fn(),
          getWorld: vi.fn(),
          deleteWorld: vi.fn()
        }
      }
    } as any);

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/worldlabs/worlds/..%2Fsecret"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Invalid WorldLabs world id"
      });
    } finally {
      await app.close();
    }
  });

  it("maps upstream list failures to a 502 response", async () => {
    const listWorlds = vi.fn<WorldLabsClient["listWorlds"]>().mockRejectedValue(
      new Error("boom")
    );
    const app = await buildServer({
      worldLabsWorlds: {
        worldLabsClient: {
          listWorlds,
          getWorld: vi.fn(),
          deleteWorld: vi.fn()
        }
      }
    } as any);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/worldlabs/worlds"
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: "WorldLabs list unavailable"
      });
    } finally {
      await app.close();
    }
  });
});
