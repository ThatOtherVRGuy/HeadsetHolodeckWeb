import { describe, expect, it, vi } from "vitest";
import { HolodeckApiClient } from "./holodeckApiClient.js";

describe("HolodeckApiClient", () => {
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
});
