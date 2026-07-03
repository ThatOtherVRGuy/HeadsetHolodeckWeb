import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildServer } from "./app.js";

describe("buildServer", () => {
  it("serves health without requiring environment secrets or a listener", async () => {
    const app = await buildServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        service: "headset-holodeck-web-server"
      });
    } finally {
      await app.close();
    }
  });

  it("serves cached generated splat files when configured", async () => {
    const generatedWorldsDir = await mkdtemp(join(tmpdir(), "hhw-worlds-"));
    await mkdir(join(generatedWorldsDir, "world-123"));
    await writeFile(
      join(generatedWorldsDir, "world-123", "full_res.spz"),
      Buffer.from([1, 2, 3])
    );
    const app = await buildServer({ generatedWorldsDir });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/generated-worlds/world-123/full_res.spz"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("model/vnd.spz");
      expect(response.rawPayload).toEqual(Buffer.from([1, 2, 3]));
    } finally {
      await app.close();
    }
  });

  it("lists cached generated splat files when configured", async () => {
    const generatedWorldsDir = await mkdtemp(join(tmpdir(), "hhw-worlds-"));
    await mkdir(join(generatedWorldsDir, "world-123"));
    await mkdir(join(generatedWorldsDir, "world-456"));
    await writeFile(
      join(generatedWorldsDir, "world-123", "full_res.spz"),
      Buffer.from([1, 2, 3])
    );
    await writeFile(
      join(generatedWorldsDir, "world-456", "preview.spz"),
      Buffer.from([4, 5])
    );
    await writeFile(
      join(generatedWorldsDir, "world-456", "notes.txt"),
      "not a splat"
    );
    const app = await buildServer({ generatedWorldsDir });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/generated-worlds"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        splats: [
          {
            worldId: "world-123",
            fileName: "full_res.spz",
            byteLength: 3,
            publicUrl: "/generated-worlds/world-123/full_res.spz"
          },
          {
            worldId: "world-456",
            fileName: "preview.spz",
            byteLength: 2,
            publicUrl: "/generated-worlds/world-456/preview.spz"
          }
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("rejects unsafe generated-world path segments", async () => {
    const app = await buildServer({ generatedWorldsDir: tmpdir() });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/generated-worlds/..%2Fsecret/full_res.spz"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Invalid generated world path"
      });
    } finally {
      await app.close();
    }
  });
});
