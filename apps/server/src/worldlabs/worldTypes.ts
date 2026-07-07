export interface WorldLabsWorld {
  world_id?: string;
  display_name?: string;
  model?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  world_prompt?: {
    type?: string;
    text_prompt?: string;
  };
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

export interface WorldLabsListResponse {
  worlds?: WorldLabsWorld[];
  next_page_token?: string | null;
}

export interface WorldLabsWorldSummary {
  worldId: string;
  displayName: string;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string;
  prompt: string;
  hasPanorama: boolean;
  hasSplat: boolean;
}

export interface WorldLabsWorldPage {
  worlds: WorldLabsWorldSummary[];
  nextPageToken?: string;
  pageSize: number;
  pageToken?: string;
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
