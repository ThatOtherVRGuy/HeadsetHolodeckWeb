import type { WorldResult } from "./worldResult";

export function createLocalSplatWorld(url: string): WorldResult {
  const trimmedUrl = url.trim();
  const fileName = trimmedUrl.split("/").filter(Boolean).at(-1) ?? "local.spz";
  const parentName =
    trimmedUrl.split("/").filter(Boolean).at(-2) ?? "local-world";
  const worldId = `local-${parentName}-${fileName.replace(/\.spz$/i, "")}`
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return {
    worldId,
    displayName: `Local splat ${parentName}/${fileName}`,
    prompt: `Local splat ${trimmedUrl}`,
    transcript: "",
    panoUrl: "",
    spzUrls: {},
    localSplat: {
      resolution: "local",
      sourceUrl: trimmedUrl,
      filePath: trimmedUrl,
      publicUrl: trimmedUrl,
      byteLength: 0
    },
    raw: {
      source: "local-spz",
      url: trimmedUrl
    }
  };
}
