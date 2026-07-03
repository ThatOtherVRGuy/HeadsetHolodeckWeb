import { describe, expect, it } from "vitest";
import {
  localSplatRenderUrl,
  localSplatUrlFromSearch
} from "./localSplatUrl.js";

describe("localSplatUrlFromSearch", () => {
  it("turns a bare query path into a generated-worlds URL", () => {
    expect(
      localSplatUrlFromSearch(
        "?f382fe75-1925-413f-8b42-fff44f13c57b/full_res.spz"
      )
    ).toBe(
      "/generated-worlds/f382fe75-1925-413f-8b42-fff44f13c57b/full_res.spz"
    );
  });

  it("accepts an explicit localSplat query parameter", () => {
    expect(localSplatUrlFromSearch("?localSplat=world-123/full_res.spz")).toBe(
      "/generated-worlds/world-123/full_res.spz"
    );
  });

  it("does not rewrite unsafe or non-spz query values", () => {
    expect(localSplatUrlFromSearch("?../secret/full_res.spz")).toBeNull();
    expect(localSplatUrlFromSearch("?https://example.test/full_res.spz")).toBeNull();
    expect(localSplatUrlFromSearch("?world-123/readme.txt")).toBeNull();
  });

  it("resolves generated-worlds URLs against the API server", () => {
    expect(
      localSplatRenderUrl(
        "/generated-worlds/world-123/full_res.spz",
        "http://localhost:4817"
      )
    ).toBe("http://localhost:4817/generated-worlds/world-123/full_res.spz");
  });

  it("leaves absolute splat URLs unchanged", () => {
    expect(
      localSplatRenderUrl(
        "https://assets.example.test/world/full_res.spz",
        "http://localhost:4817"
      )
    ).toBe("https://assets.example.test/world/full_res.spz");
  });
});
