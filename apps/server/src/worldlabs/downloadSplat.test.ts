import { mkdtemp, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { downloadSplat } from "./downloadSplat.js";
import type { WorldResult } from "./worldTypes.js";

const world: WorldResult = {
  worldId: "world-123",
  displayName: "Autumn Park",
  prompt: "park",
  transcript: "park",
  panoUrl: "https://example.test/pano.png",
  spzUrls: {
    "100k": "https://example.test/100k.spz",
    full_res: "https://example.test/full.spz"
  },
  raw: {}
};

describe("downloadSplat", () => {
  it("downloads the preferred splat resolution to a local file", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "hhw-splat-"));
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" }
      })
    );

    const result = await downloadSplat(world, {
      outputDir,
      preferredResolution: "full_res",
      fetch
    });

    expect(result).toEqual({
      resolution: "full_res",
      sourceUrl: "https://example.test/full.spz",
      filePath: join(outputDir, "world-123", "full_res.spz"),
      byteLength: 3
    });
    expect(await readFile(result.filePath)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetch).toHaveBeenCalledWith("https://example.test/full.spz", {
      signal: undefined
    });
  });

  it("falls back to the best available resolution", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "hhw-splat-"));
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(new Uint8Array([4]), { status: 200 })
    );

    const result = await downloadSplat(
      {
        ...world,
        spzUrls: {
          "100k": "https://example.test/100k.spz",
          "500k": "https://example.test/500k.spz"
        }
      },
      { outputDir, preferredResolution: "full_res", fetch }
    );

    expect(result.resolution).toBe("500k");
    expect(await stat(result.filePath)).toMatchObject({ size: 1 });
  });

  it("throws when no splat URLs are available", async () => {
    await expect(
      downloadSplat({ ...world, spzUrls: {} }, { outputDir: tmpdir() })
    ).rejects.toThrow("World world-123 did not include splat URLs");
  });
});
