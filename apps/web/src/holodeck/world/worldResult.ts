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
    publicUrl?: string;
    byteLength: number;
  };
  meshUrl?: string;
  raw: unknown;
}
