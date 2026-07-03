import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorldResult } from "./worldTypes.js";

const resolutionPreference = ["full_res", "500k", "150k", "100k"];

export interface DownloadSplatOptions {
  outputDir: string;
  preferredResolution?: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export interface DownloadedSplat {
  resolution: string;
  sourceUrl: string;
  filePath: string;
  byteLength: number;
}

export async function downloadSplat(
  world: WorldResult,
  options: DownloadSplatOptions
): Promise<DownloadedSplat> {
  const selected = selectSplatUrl(
    world.spzUrls,
    options.preferredResolution ?? "full_res"
  );

  if (!selected) {
    throw new Error(`World ${world.worldId} did not include splat URLs`);
  }

  const fetch = options.fetch ?? globalThis.fetch;
  const response = await fetch(selected.url, { signal: options.signal });

  if (!response.ok) {
    throw new Error(
      `Splat download failed with ${response.status} ${response.statusText}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const worldFolder = join(options.outputDir, sanitizePathSegment(world.worldId));
  const filePath = join(
    worldFolder,
    `${sanitizePathSegment(selected.resolution)}.spz`
  );

  await mkdir(worldFolder, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    resolution: selected.resolution,
    sourceUrl: selected.url,
    filePath,
    byteLength: bytes.byteLength
  };
}

function selectSplatUrl(
  urls: Record<string, string>,
  preferredResolution: string
): { resolution: string; url: string } | null {
  const candidates = [
    preferredResolution,
    ...resolutionPreference,
    ...Object.keys(urls).sort()
  ];

  for (const resolution of candidates) {
    const url = urls[resolution]?.trim();

    if (url) {
      return { resolution, url };
    }
  }

  return null;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "world";
}
