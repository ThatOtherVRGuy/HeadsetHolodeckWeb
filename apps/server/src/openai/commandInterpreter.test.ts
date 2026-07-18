import { describe, expect, it, vi } from "vitest";
import { OpenAiCommandInterpreter } from "./commandInterpreter.js";

describe("OpenAiCommandInterpreter", () => {
  it("asks OpenAI to classify a transcript and returns normalized JSON", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  route: "command",
                  canonicalCommand: "hide arch",
                  reason: "ASR homophone"
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    const client = new OpenAiCommandInterpreter("openai-key", {
      baseUrl: "https://openai.test/v1",
      model: "test-model",
      fetch
    });
    const abortController = new AbortController();

    const result = await client.interpretTranscript("I'd fart.", {
      signal: abortController.signal
    });

    expect(result).toEqual({
      route: "command",
      canonicalCommand: "hide arch",
      reason: "ASR homophone"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://openai.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer openai-key",
          "content-type": "application/json",
          Accept: "application/json"
        },
        signal: abortController.signal
      })
    );
    const [, request] = fetch.mock.calls[0];
    const body = JSON.parse((request as RequestInit).body as string) as {
      model: string;
      temperature: number;
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("hide arch");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "I'd fart."
    });
  });

  it("returns ignore when OpenAI returns invalid JSON content", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not json" } }]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    const client = new OpenAiCommandInterpreter("openai-key", { fetch });

    await expect(client.interpretTranscript("hello")).resolves.toEqual({
      route: "ignore",
      reason: "invalid interpreter JSON"
    });
  });

  it("throws a useful error when OpenAI returns a non-OK response", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(
      new Response("bad key", {
        status: 401,
        statusText: "Unauthorized"
      })
    );
    const client = new OpenAiCommandInterpreter("openai-key", {
      baseUrl: "https://openai.test/v1",
      fetch
    });

    await expect(client.interpretTranscript("hide arch")).rejects.toThrow(
      "OpenAI command interpretation failed with 401 Unauthorized: bad key"
    );
  });
});
