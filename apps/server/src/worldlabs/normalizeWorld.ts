import type { WorldLabsWorld, WorldResult } from "./worldTypes.js";

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
