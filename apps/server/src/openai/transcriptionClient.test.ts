import { describe, expect, it, vi } from "vitest";
import { OpenAiTranscriptionClient } from "./transcriptionClient.js";

describe("OpenAiTranscriptionClient", () => {
  it("posts audio to OpenAI and returns trimmed transcript text", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ text: "  Build a crystal cave.  " }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new OpenAiTranscriptionClient("openai-key", {
      baseUrl: "https://openai.test/v1",
      fetch
    });
    const abortController = new AbortController();

    const result = await client.transcribe(
      new Uint8Array([1, 2, 3]),
      "speech.webm",
      "audio/webm",
      { signal: abortController.signal }
    );

    expect(result).toBe("Build a crystal cave.");
    expect(fetch).toHaveBeenCalledWith(
      "https://openai.test/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer openai-key",
          Accept: "application/json"
        },
        signal: abortController.signal,
        body: expect.any(FormData)
      })
    );
  });

  it("throws a useful error when OpenAI returns a non-OK response", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "content-type": "application/json" }
      })
    );
    const client = new OpenAiTranscriptionClient("openai-key", {
      baseUrl: "https://openai.test/v1",
      fetch
    });

    await expect(
      client.transcribe(new Uint8Array([1]), "speech.webm", "audio/webm")
    ).rejects.toThrow(
      "OpenAI transcription failed with 401 Unauthorized: bad key"
    );
  });

  it("throws when OpenAI returns empty transcript text", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ text: "   " }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const client = new OpenAiTranscriptionClient("openai-key", {
      baseUrl: "https://openai.test/v1",
      fetch
    });

    await expect(
      client.transcribe(new Uint8Array([1]), "speech.webm", "audio/webm")
    ).rejects.toThrow("OpenAI transcription returned empty text");
  });
});
