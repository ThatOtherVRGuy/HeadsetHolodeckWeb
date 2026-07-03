import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env.js";

describe("readServerEnv", () => {
  it("reads required keys from a plain object", () => {
    const env = readServerEnv({
      OPENAI_API_KEY: "sk-test",
      WORLDLABS_API_KEY: "wl-test",
      PORT: "4817"
    });

    expect(env).toEqual({
      openAiApiKey: "sk-test",
      worldLabsApiKey: "wl-test",
      port: 4817
    });
  });

  it("rejects missing API keys", () => {
    expect(() => readServerEnv({})).toThrow(
      "OPENAI_API_KEY and WORLDLABS_API_KEY are required"
    );
  });

  it("defaults blank port to the development port", () => {
    const env = readServerEnv({
      OPENAI_API_KEY: "sk-test",
      WORLDLABS_API_KEY: "wl-test",
      PORT: " "
    });

    expect(env.port).toBe(4817);
  });

  it("rejects invalid ports", () => {
    expect(() =>
      readServerEnv({
        OPENAI_API_KEY: "sk-test",
        WORLDLABS_API_KEY: "wl-test",
        PORT: "abc"
      })
    ).toThrow("PORT must be an integer between 0 and 65535");
  });

  it("allows port zero for ephemeral test servers", () => {
    const env = readServerEnv({
      OPENAI_API_KEY: "sk-test",
      WORLDLABS_API_KEY: "wl-test",
      PORT: "0"
    });

    expect(env.port).toBe(0);
  });
});
