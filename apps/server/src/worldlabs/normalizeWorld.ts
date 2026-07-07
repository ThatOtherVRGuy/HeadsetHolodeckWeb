import type {
  WorldLabsListResponse,
  WorldLabsWorld,
  WorldLabsWorldPage,
  WorldLabsWorldSummary,
  WorldResult
} from "./worldTypes.js";

export function normalizeWorldSummary(
  world: WorldLabsWorld
): WorldLabsWorldSummary | null {
  const worldId = readString(world.world_id);
  if (!worldId) {
    return null;
  }

  const spzUrls = world.assets?.splats?.spz_urls ?? {};
  return {
    worldId,
    displayName: readString(world.display_name) || worldId,
    model: readString(world.model),
    status: readString(world.status),
    createdAt: readString(world.created_at),
    updatedAt: readString(world.updated_at),
    thumbnailUrl: readString(world.assets?.thumbnail_url),
    prompt: readString(world.world_prompt?.text_prompt),
    hasPanorama: Boolean(readString(world.assets?.imagery?.pano_url)),
    hasSplat: Object.values(spzUrls).some((url) => readString(url).length > 0)
  };
}

export function normalizeWorldPage(
  response: WorldLabsListResponse,
  request: { pageSize: number; pageToken?: string }
): WorldLabsWorldPage {
  return {
    worlds: (response.worlds ?? [])
      .map((world) => normalizeWorldSummary(world))
      .filter((world): world is WorldLabsWorldSummary => world !== null),
    ...(readString(response.next_page_token)
      ? { nextPageToken: readString(response.next_page_token) }
      : {}),
    pageSize: request.pageSize,
    ...(request.pageToken ? { pageToken: request.pageToken } : {})
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
