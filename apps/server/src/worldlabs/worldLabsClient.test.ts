import { describe, expect, it, vi } from "vitest";
import { WorldLabsClient } from "./worldLabsClient.js";

describe("WorldLabsClient", () => {
  it("generates a world, polls until done, and returns the normalized result", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "running" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "done",
            response: {
              world_id: "world-123",
              display_name: "Crystal Cave",
              assets: {
                imagery: {
                  pano_url: "https://example.test/pano.jpg"
                }
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 0,
      timeoutMs: 100
    });
    const abortController = new AbortController();

    await expect(
      client.generateWorldFromText(
        "make a crystal cave",
        "Make a crystal cave.",
        { signal: abortController.signal }
      )
    ).resolves.toEqual({
      worldId: "world-123",
      displayName: "Crystal Cave",
      prompt: "make a crystal cave",
      transcript: "Make a crystal cave.",
      panoUrl: "https://example.test/pano.jpg",
      spzUrls: {},
      raw: {
        world_id: "world-123",
        display_name: "Crystal Cave",
        assets: {
          imagery: {
            pano_url: "https://example.test/pano.jpg"
          }
        }
      }
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://worldlabs.test/marble/v1/worlds:generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "WLT-Api-Key": "worldlabs-key"
        }),
        signal: abortController.signal,
        body: JSON.stringify({
          world_prompt: {
            type: "text",
            text_prompt: "make a crystal cave"
          },
          display_name: "make a crystal cave",
          model: "marble-1.1",
          permission: {
            allowed_readers: [],
            allowed_writers: [],
            public: false
          }
        })
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://worldlabs.test/marble/v1/operations/op-123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "WLT-Api-Key": "worldlabs-key"
        }),
        signal: abortController.signal
      })
    );
  });

  it("stops polling when the request is aborted", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "running" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 10_000,
      timeoutMs: 60_000
    });
    const abortController = new AbortController();
    const result = client.generateWorldFromText("prompt", "prompt", {
      signal: abortController.signal
    });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    abortController.abort();

    await expect(result).rejects.toThrow("The operation was aborted.");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when the operation reports an error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "error",
            error: { message: "World generation failed" }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 0,
      timeoutMs: 100
    });

    await expect(client.generateWorldFromText("prompt")).rejects.toThrow(
      "World Labs operation op-123 failed: World generation failed"
    );
  });

  it("treats World Labs done=true operations as complete", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            done: true,
            metadata: {
              progress: {
                status: "SUCCEEDED"
              }
            },
            response: {
              world_id: "world-123",
              display_name: "Autumn Park",
              assets: {
                imagery: {
                  pano_url: "https://example.test/park.png"
                }
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 0,
      timeoutMs: 100
    });

    await expect(client.generateWorldFromText("park")).resolves.toMatchObject({
      worldId: "world-123",
      displayName: "Autumn Park",
      panoUrl: "https://example.test/park.png"
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports operation id and progress snapshots while polling", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            done: false,
            metadata: {
              progress: {
                status: "RUNNING",
                description: "Rendering splats"
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            done: true,
            metadata: {
              progress: {
                status: "SUCCEEDED",
                description: "World generation completed successfully"
              },
              world_id: "world-123"
            },
            response: {
              world_id: "world-123",
              display_name: "Autumn Park",
              assets: {
                imagery: {
                  pano_url: "https://example.test/park.png"
                }
              }
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 0,
      timeoutMs: 100
    });
    const onProgress = vi.fn();

    await client.generateWorldFromText("park", "park", { onProgress });

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      operationId: "op-123",
      status: "created",
      description: "World generation operation created"
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      operationId: "op-123",
      status: "running",
      description: "Rendering splats"
    });
    expect(onProgress).toHaveBeenNthCalledWith(3, {
      operationId: "op-123",
      status: "succeeded",
      description: "World generation completed successfully",
      worldId: "world-123"
    });
  });

  it("throws when polling times out before the operation is done", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ operation_id: "op-123" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "running" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch,
      pollIntervalMs: 10,
      timeoutMs: 1
    });

    await expect(client.generateWorldFromText("prompt")).rejects.toThrow(
      "World Labs operation op-123 timed out after 1ms"
    );
  });

  it("lists account worlds with pagination options", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          worlds: [{ world_id: "world-123", display_name: "Park" }],
          next_page_token: "next-token"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(
      client.listWorlds({ pageSize: 12, pageToken: "page-token" })
    ).resolves.toMatchObject({
      worlds: [{ worldId: "world-123", displayName: "Park" }],
      nextPageToken: "next-token",
      pageSize: 12,
      pageToken: "page-token"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://worldlabs.test/marble/v1/worlds:list",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "WLT-Api-Key": "worldlabs-key"
        }),
        body: JSON.stringify({
          page_size: 12,
          page_token: "page-token",
          sort_by: "created_at"
        })
      })
    );
  });

  it("clamps listed world page sizes to the supported range", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ worlds: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await client.listWorlds({ pageSize: 500 });

    expect(fetch).toHaveBeenCalledWith(
      "https://worldlabs.test/marble/v1/worlds:list",
      expect.objectContaining({
        body: JSON.stringify({
          page_size: 100,
          sort_by: "created_at"
        })
      })
    );
  });

  it("gets a world by id as a renderable WorldResult", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          world_id: "world-123",
          display_name: "Park",
          world_prompt: { type: "text", text_prompt: "a park" },
          assets: {
            thumbnail_url: "https://example.test/thumb.jpg",
            imagery: { pano_url: "https://example.test/pano.jpg" },
            splats: { spz_urls: { full_res: "https://example.test/full.spz" } }
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.getWorld("world-123")).resolves.toMatchObject({
      worldId: "world-123",
      displayName: "Park",
      prompt: "a park",
      transcript: "a park",
      panoUrl: "https://example.test/pano.jpg",
      thumbnailUrl: "https://example.test/thumb.jpg",
      spzUrls: { full_res: "https://example.test/full.spz" }
    });
  });

  it("rejects empty world ids when fetching or deleting", async () => {
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch: vi.fn<typeof globalThis.fetch>()
    });

    await expect(client.getWorld("   ")).rejects.toThrow(
      "World ID must be a non-empty string"
    );
    await expect(client.deleteWorld("")).rejects.toThrow(
      "World ID must be a non-empty string"
    );
  });

  it("deletes a world by id", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.deleteWorld("world-123")).resolves.toEqual({
      worldId: "world-123",
      deleted: true
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://worldlabs.test/marble/v1/worlds/world-123",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          "WLT-Api-Key": "worldlabs-key"
        })
      })
    );
  });

  it("throws useful errors when world account calls fail", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "nope" }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.listWorlds()).rejects.toThrow(
      "World Labs world listing failed with 403 Forbidden: nope"
    );
  });

  it("rejects malformed JSON when listing account worlds", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.listWorlds()).rejects.toThrow(
      "World Labs list worlds returned invalid JSON"
    );
  });

  it("treats 204 delete responses as successful deletions", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(null, {
        status: 204
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.deleteWorld("world-123")).resolves.toEqual({
      worldId: "world-123",
      deleted: true
    });
  });

  it("treats empty-body ok delete responses as successful deletions", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new WorldLabsClient("worldlabs-key", {
      baseUrl: "https://worldlabs.test",
      fetch
    });

    await expect(client.deleteWorld("world-123")).resolves.toEqual({
      worldId: "world-123",
      deleted: true
    });
  });
});
