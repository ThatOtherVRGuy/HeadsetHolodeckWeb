import type {
  WorldLabsListResponse,
  WorldLabsWorld,
  WorldLabsWorldPage,
  WorldLabsWorldSummary,
  WorldResult
} from "./worldTypes.js";

export function normalizeWorldSummary(
  world: unknown
): WorldLabsWorldSummary | null {
  if (!isObject(world)) {
    return null;
  }

  const worldData = world as WorldLabsWorld;
  const worldId = readString(worldData.world_id);
  if (!worldId) {
    return null;
  }

  const spzUrls = worldData.assets?.splats?.spz_urls ?? {};
  return {
    worldId,
    displayName: readString(worldData.display_name) || worldId,
    model: readString(worldData.model),
    status: readString(worldData.status),
    createdAt: readString(worldData.created_at),
    updatedAt: readString(worldData.updated_at),
    thumbnailUrl: readString(worldData.assets?.thumbnail_url),
    prompt: readString(worldData.world_prompt?.text_prompt),
    hasPanorama: Boolean(readString(worldData.assets?.imagery?.pano_url)),
    hasSplat: Object.values(spzUrls).some((url) => readString(url).length > 0)
  };
}

export function normalizeWorldPage(
  response: WorldLabsListResponse,
  request: { pageSize: number; pageToken?: string }
): WorldLabsWorldPage {
  const nextPageToken = readString(response.next_page_token);
  const pageToken = readString(request.pageToken);
  const worlds = Array.isArray(response.worlds) ? response.worlds : [];

  return {
    worlds: worlds
      .map((world) => normalizeWorldSummary(world))
      .filter((world): world is WorldLabsWorldSummary => world !== null),
    ...(nextPageToken ? { nextPageToken } : {}),
    pageSize: request.pageSize,
    ...(pageToken ? { pageToken } : {})
  };
}

export function normalizeWorld(
  world: WorldLabsWorld,
  context: { prompt: string; transcript: string }
): WorldResult {
  const panoUrl = world.assets?.imagery?.pano_url?.trim() ?? "";

  if (!panoUrl) {
    throw new Error("World Labs result did not include a panorama URL");
  }

  const worldId = world.world_id?.trim() ?? "";
  const displayName =
    world.display_name?.trim() || worldId || "Untitled World";

  return {
    worldId,
    displayName,
    prompt: context.prompt,
    transcript: context.transcript,
    panoUrl,
    thumbnailUrl: world.assets?.thumbnail_url,
    spzUrls: world.assets?.splats?.spz_urls ?? {},
    meshUrl: world.assets?.mesh?.collider_mesh_url,
    raw: world
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
