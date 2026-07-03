import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";
import type { TranscriptionClient } from "../openai/transcriptionClient.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

function multipartPayload(
  parts: Array<{
    name: string;
    value: Buffer | string;
    filename?: string;
    contentType?: string;
  }>
) {
  const boundary = "test-boundary";
  const chunks: Buffer[] = [];

  for (const part of parts) {
    const headers = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${part.name}"${
        part.filename ? `; filename="${part.filename}"` : ""
      }`,
      ...(part.contentType ? [`Content-Type: ${part.contentType}`] : []),
      "",
      ""
    ].join("\r\n");

    chunks.push(Buffer.from(headers));
    chunks.push(
      typeof part.value === "string" ? Buffer.from(part.value) : part.value
    );
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: Buffer.concat(chunks)
  };
}

describe("POST /api/voice-to-world", () => {
  it("transcribes an uploaded audio file and returns the generated world", async () => {
    const transcribe = vi.fn<TranscriptionClient["transcribe"]>();
    transcribe.mockResolvedValue("A glass forest at sunrise");
    const generateWorldFromText =
      vi.fn<WorldLabsClient["generateWorldFromText"]>();
    generateWorldFromText.mockResolvedValue({
      worldId: "world-123",
      displayName: "Glass Forest",
      prompt: "A glass forest at sunrise",
      transcript: "A glass forest at sunrise",
      panoUrl: "https://example.test/pano.jpg",
      spzUrls: {},
      raw: { world_id: "world-123" }
    });
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: { transcribe },
        worldLabsClient: { generateWorldFromText }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.from([1, 2, 3]),
          filename: "prompt.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        worldId: "world-123",
        displayName: "Glass Forest",
        prompt: "A glass forest at sunrise",
        transcript: "A glass forest at sunrise",
        panoUrl: "https://example.test/pano.jpg",
        spzUrls: {},
        raw: { world_id: "world-123" }
      });
      expect(transcribe).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        "prompt.webm",
        "audio/webm",
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
      expect(generateWorldFromText).toHaveBeenCalledWith(
        "A glass forest at sunrise",
        "A glass forest at sunrise",
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 400 when the multipart request does not include an audio file", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi.fn()
        },
        worldLabsClient: {
          generateWorldFromText: vi.fn()
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "note",
          value: "no audio here"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Audio file is required"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 400 when the uploaded audio file is empty", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi.fn()
        },
        worldLabsClient: {
          generateWorldFromText: vi.fn()
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.alloc(0),
          filename: "empty.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Audio file is empty"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 502 when transcription fails", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi
            .fn<TranscriptionClient["transcribe"]>()
            .mockRejectedValue(new Error("OpenAI rejected the audio"))
        },
        worldLabsClient: {
          generateWorldFromText: vi.fn()
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.from([1, 2, 3]),
          filename: "prompt.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: "Transcription failed"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 502 when transcription times out", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi
            .fn<TranscriptionClient["transcribe"]>()
            .mockRejectedValue(new Error("OpenAI transcription timed out"))
        },
        worldLabsClient: {
          generateWorldFromText: vi.fn()
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.from([1, 2, 3]),
          filename: "prompt.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: "Transcription failed"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 504 when world generation times out", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi
            .fn<TranscriptionClient["transcribe"]>()
            .mockResolvedValue("A glass forest at sunrise")
        },
        worldLabsClient: {
          generateWorldFromText: vi
            .fn<WorldLabsClient["generateWorldFromText"]>()
            .mockRejectedValue(new Error("World Labs operation op-123 timed out after 1ms"))
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.from([1, 2, 3]),
          filename: "prompt.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(504);
      expect(response.json()).toEqual({
        error: "World generation timed out"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 502 when world generation fails", async () => {
    const app = await buildServer({
      voiceToWorld: {
        transcriptionClient: {
          transcribe: vi
            .fn<TranscriptionClient["transcribe"]>()
            .mockResolvedValue("A glass forest at sunrise")
        },
        worldLabsClient: {
          generateWorldFromText: vi
            .fn<WorldLabsClient["generateWorldFromText"]>()
            .mockRejectedValue(new Error("World generation failed"))
        }
      }
    });

    try {
      const form = multipartPayload([
        {
          name: "audio",
          value: Buffer.from([1, 2, 3]),
          filename: "prompt.webm",
          contentType: "audio/webm"
        }
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/voice-to-world",
        headers: form.headers,
        payload: form.payload
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({
        error: "World generation failed"
      });
    } finally {
      await app.close();
    }
  });
});
