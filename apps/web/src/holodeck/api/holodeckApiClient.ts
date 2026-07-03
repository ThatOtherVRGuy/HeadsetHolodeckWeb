import type { WorldResult } from "../world/worldResult";

export interface HolodeckApi {
  voiceToWorld(audio: Blob): Promise<WorldResult>;
}

export class HolodeckApiClient implements HolodeckApi {
  constructor(private readonly baseUrl = "http://localhost:4817") {}

  async voiceToWorld(audio: Blob): Promise<WorldResult> {
    const formData = new FormData();
    formData.append("audio", audio, "command.webm");

    const response = await fetch(`${this.baseUrl}/api/voice-to-world`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voice-to-world failed: HTTP ${response.status} ${body}`);
    }

    const world = (await response.json()) as WorldResult;

    if (world.localSplat?.publicUrl) {
      world.localSplat.publicUrl = new URL(
        world.localSplat.publicUrl,
        this.baseUrl
      ).toString();
    }

    return world;
  }
}
