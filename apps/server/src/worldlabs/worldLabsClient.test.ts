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
      "https://worldlabs.test/marble/v1/worlds",
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
          permission: "private"
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
});
