export interface WorldResult {
  worldId: string;
  displayName: string;
  prompt: string;
  transcript: string;
  panoUrl: string;
  thumbnailUrl?: string;
  spzUrls: Record<string, string>;
  localSplat?: {
    resolution: string;
    sourceUrl: string;
    filePath: string;
    placement?: SplatPlacement;
    publicUrl?: string;
    byteLength: number;
  };
  meshUrl?: string;
  raw: unknown;
}

export interface WorldLabsWorldSummary {
  worldId: string;
  displayName: string;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
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

export interface WorldLabsDeleteResult {
  worldId: string;
  deleted: boolean;
}

export type SplatPlacement = "world" | "loose-object";
