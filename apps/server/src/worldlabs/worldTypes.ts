export interface WorldLabsWorld {
  world_id?: string;
  display_name?: string;
  assets?: {
    thumbnail_url?: string;
    imagery?: {
      pano_url?: string;
    };
    splats?: {
      spz_urls?: Record<string, string>;
    };
    mesh?: {
      collider_mesh_url?: string;
    };
  };
}

export interface WorldResult {
  worldId: string;
  displayName: string;
  prompt: string;
  transcript: string;
  panoUrl: string;
  thumbnailUrl?: string;
  spzUrls: Record<string, string>;
  meshUrl?: string;
  raw: unknown;
}
