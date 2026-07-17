import { describe, expect, it, vi } from "vitest";
import { HolodeckApiClient } from "./holodeckApiClient.js";

describe("HolodeckApiClient", () => {
  it("calls injected fetch with the global receiver", async () => {
    const fetch = vi.fn(function (
      this: typeof globalThis,
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            jobId: "job_123",
            status: "running",
            stage: "transcription",
            message: "Transcribing voice prompt."
          }),
          { status: 202, headers: { "content-type": "application/json" } }
        )
      );
    }) as unknown as typeof globalThis.fetch;
    const client = new HolodeckApiClient("http://api.test", fetch);

    await expect(
      client.startVoiceToWorldJob(new Blob(["audio"]))
    ).resolves.toMatchObject({
      jobId: "job_123"
    });
  });

  it("starts and reads voice-to-world jobs", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job_123",
            status: "running",
            stage: "transcription",
            message: "Transcribing voice prompt."
          }),
          { status: 202, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job_123",
            status: "complete",
            stage: "complete",
            message: "World ready.",
            world: {
              worldId: "world-123",
              displayName: "Glass Forest",
              prompt: "Glass forest",
              transcript: "Glass forest",
              panoUrl: "https://example.test/pano.jpg",
              spzUrls: {},
              localSplat: {
                resolution: "full_res",
                sourceUrl: "https://example.test/full_res.spz",
                filePath: "/tmp/full_res.spz",
                publicUrl: "/generated-worlds/world-123/full_res.spz",
                byteLength: 123
              },
              raw: {}
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    const client = new HolodeckApiClient("http://api.test", fetch);

    const started = await client.startVoiceToWorldJob(new Blob(["audio"]));
    const completed = await client.getVoiceToWorldJob(started.jobId);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://api.test/api/voice-to-world/jobs",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://api.test/api/voice-to-world/jobs/job_123"
    );
    expect(completed.world?.localSplat?.publicUrl).toBe(
      "http://api.test/generated-worlds/world-123/full_res.spz"
    );
  });

  it("transcribes audio without starting world generation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ transcript: "move world up 3 feet" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new HolodeckApiClient("http://api.test", fetch);

    await expect(client.transcribeAudio?.(new Blob(["audio"]))).resolves.toBe(
      "move world up 3 feet"
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/transcriptions",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
  });

  it("starts a text-to-world job from an existing transcript", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: "job_text",
          status: "running",
          stage: "world-generation",
          message: "Generating world."
        }),
        { status: 202, headers: { "content-type": "application/json" } }
      )
    );
    const client = new HolodeckApiClient("http://api.test", fetch);

    await expect(
      client.startTextToWorldJob?.("A glass forest")
    ).resolves.toMatchObject({
      jobId: "job_text",
      stage: "world-generation"
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/voice-to-world/text-jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transcript: "A glass forest" })
      })
    );
  });

  it("supports a same-origin relative API base for headset browser testing", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            worlds: [],
            pageSize: 9
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            worldId: "world-123",
            displayName: "Glass Forest",
            prompt: "Glass forest",
            transcript: "Glass forest",
            panoUrl: "",
            spzUrls: {},
            localSplat: {
              resolution: "full_res",
              sourceUrl: "https://example.test/full_res.spz",
              filePath: "/tmp/full_res.spz",
              publicUrl: "/generated-worlds/world-123/full_res.spz",
              byteLength: 123
            },
            raw: {}
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    const client = new HolodeckApiClient("", fetch);

    await client.listWorldLabsWorlds?.({ pageSize: 9, pageToken: "next" });
    const world = await client.getWorldLabsWorld?.("world-123");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/worldlabs/worlds?pageSize=9&pageToken=next"
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/worldlabs/worlds/world-123"
    );
    expect(world?.localSplat?.publicUrl).toBe(
      "/generated-worlds/world-123/full_res.spz"
    );
  });

  it("lists World Labs worlds with the requested query string", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          worlds: [],
          pageSize: 10,
          pageToken: "token-1"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = new HolodeckApiClient("http://api.test", fetch);

    await client.listWorldLabsWorlds({
      pageSize: 10,
      pageToken: "token-1"
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/worldlabs/worlds?pageSize=10&pageToken=token-1"
    );
  });

  it("normalizes returned World Labs world local splat URLs", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          worldId: "world-123",
          displayName: "Glass Forest",
          prompt: "Glass forest",
          transcript: "Glass forest",
          panoUrl: "https://example.test/pano.jpg",
          spzUrls: {},
          localSplat: {
            resolution: "full_res",
            sourceUrl: "https://example.test/full_res.spz",
            filePath: "/tmp/full_res.spz",
            publicUrl: "/generated-worlds/world-123/full_res.spz",
            byteLength: 123
          },
          raw: {}
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const client = new HolodeckApiClient("http://api.test", fetch);

    const world = await client.getWorldLabsWorld("world-123");

    expect(world.localSplat?.publicUrl).toBe(
      "http://api.test/generated-worlds/world-123/full_res.spz"
    );
  });

  it("deletes a World Labs world with an encoded world ID", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ worldId: "world/123", deleted: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new HolodeckApiClient("http://api.test", fetch);

    await client.deleteWorldLabsWorld("world/123");

    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/worldlabs/worlds/world%2F123",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });
});
