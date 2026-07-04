const generatedWorldsPrefix = "/generated-worlds/";

export function localSplatRenderUrl(url: string, apiBaseUrl: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return new URL(url, apiBaseUrl).toString();
}

export function localSplatUrlFromSearch(search: string): string | null {
  if (!search.startsWith("?") || search.length <= 1) {
    return null;
  }

  const query = search.slice(1);
  const params = new URLSearchParams(query);
  const explicitValue = params.get("localSplat");
  const value = explicitValue ?? query;

  let decodedValue: string;
  try {
    decodedValue = decodeURIComponent(value).trim();
  } catch {
    return null;
  }

  if (decodedValue.startsWith(generatedWorldsPrefix)) {
    decodedValue = decodedValue.slice(generatedWorldsPrefix.length);
  }

  const parts = decodedValue.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const [worldId, fileName] = parts;
  if (!isSafePathSegment(worldId) || !isSafePathSegment(fileName)) {
    return null;
  }

  if (!fileName.toLowerCase().endsWith(".spz")) {
    return null;
  }

  return `${generatedWorldsPrefix}${worldId}/${fileName}`;
}

function isSafePathSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}
