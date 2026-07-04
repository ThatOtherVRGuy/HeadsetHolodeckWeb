import type { WorldResult } from "./worldResult";

interface BrowserSplatFile {
  name: string;
  size: number;
}

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
      placement: "world",
      publicUrl: trimmedUrl,
      byteLength: 0
    },
    raw: {
      source: "local-spz",
      url: trimmedUrl
    }
  };
}

export function createBrowserFileSplatWorld(
  file: BrowserSplatFile,
  objectUrl: string
): WorldResult {
  const fileName = file.name.trim() || "local.spz";
  const worldId = `local-file-${fileName.replace(/\.spz$/i, "")}`
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return {
    worldId,
    displayName: `Local splat ${fileName}`,
    prompt: `Local splat ${fileName}`,
    transcript: "",
    panoUrl: "",
    spzUrls: {},
    localSplat: {
      resolution: "local",
      sourceUrl: objectUrl,
      filePath: fileName,
      placement: "loose-object",
      publicUrl: objectUrl,
      byteLength: file.size
    },
    raw: {
      source: "browser-file-spz",
      fileName,
      objectUrl
    }
  };
}
