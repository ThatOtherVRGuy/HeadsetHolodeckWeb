import { describe, expect, it, vi } from "vitest";

import type { HolodeckApi } from "../api/holodeckApiClient";
import type { WorldRenderer } from "../rendering/worldRenderer";
import { HolodeckStateMachine } from "../state/holodeckState";
import type { WorldResult } from "../world/worldResult";
import { VoiceToWorldCoordinator } from "./voiceToWorldCoordinator";

describe("VoiceToWorldCoordinator", () => {
  function createWorld(overrides: Partial<WorldResult> = {}): WorldResult {
    return {
      worldId: "world_123",
      displayName: "Crystal Atrium",
      prompt: "Crystal Atrium",
      transcript: "Crystal Atrium",
      panoUrl: "https://example.com/world_123/pano.jpg",
      spzUrls: {},
      raw: {},
      ...overrides,
    };
  }

  function createRenderer(calls: string[] = []): WorldRenderer {
    return {
      mode: "panorama",
      load: async (loadedWorld) => {
        calls.push(loadedWorld.worldId);
      },
      show: () => calls.push("show"),
      hide: () => calls.push("hide"),
      dispose: () => calls.push("dispose"),
    };
  }

  it("generates a world from audio and shows it when loading succeeds", async () => {
    const state = new HolodeckStateMachine();
    const world = createWorld();
    const api: HolodeckApi = {
      voiceToWorld: async () => world,
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({ state, api, renderer });

    const result = await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(result).toBe(world);
    expect(state.current).toBe("Ready");
    expect(rendererCalls).toEqual(["world_123", "show"]);
  });

  it("notifies when a generated world is shown", async () => {
    const state = new HolodeckStateMachine();
    const world = createWorld();
    const shownWorlds: string[] = [];
    const api: HolodeckApi = {
      voiceToWorld: async () => world,
    };
    const renderer = createRenderer();
    const coordinator = new VoiceToWorldCoordinator({
      state,
      api,
      renderer,
      onWorldShown: (shownWorld) => shownWorlds.push(shownWorld.worldId)
    });

    await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(shownWorlds).toEqual(["world_123"]);
  });

  it("polls a voice-to-world job and reports progress until the world is ready", async () => {
    const state = new HolodeckStateMachine();
    const world = createWorld();
    const progressMessages: string[] = [];
    const pollCounts: number[] = [];
    const api: HolodeckApi = {
      voiceToWorld: vi.fn(),
      startVoiceToWorldJob: vi.fn().mockResolvedValue({
        jobId: "job_123",
        status: "running",
        stage: "transcription",
        message: "Transcribing voice prompt."
      }),
      getVoiceToWorldJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: "job_123",
          status: "running",
          stage: "world-generation",
          message: "Rendering splats",
          progress: {
            status: "running",
            description: "Rendering splats"
          }
        })
        .mockResolvedValueOnce({
          jobId: "job_123",
          status: "complete",
          stage: "complete",
          message: "World ready.",
          world
        })
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({
      state,
      api,
      renderer,
      pollIntervalMs: 0,
      onProgress: (job, progress) => {
        progressMessages.push(job.message);
        pollCounts.push(progress.pollCount);
      }
    });

    await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(api.startVoiceToWorldJob).toHaveBeenCalledOnce();
    expect(api.getVoiceToWorldJob).toHaveBeenCalledWith("job_123");
    expect(state.current).toBe("Ready");
    expect(progressMessages).toEqual([
      "Transcribing voice prompt.",
      "Rendering splats",
      "World ready."
    ]);
    expect(pollCounts).toEqual([0, 1, 2]);
    expect(rendererCalls).toEqual(["world_123", "show"]);
  });

  it("generates a world from an existing transcript job", async () => {
    const state = new HolodeckStateMachine();
    const world = createWorld();
    const progressMessages: string[] = [];
    const api: HolodeckApi = {
      voiceToWorld: vi.fn(),
      startTextToWorldJob: vi.fn().mockResolvedValue({
        jobId: "job_text",
        status: "running",
        stage: "world-generation",
        message: "Generating world."
      }),
      getVoiceToWorldJob: vi.fn().mockResolvedValue({
        jobId: "job_text",
        status: "complete",
        stage: "complete",
        message: "World ready.",
        world
      })
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({
      state,
      api,
      renderer,
      pollIntervalMs: 0,
      onProgress: (job) => progressMessages.push(job.message)
    });

    const result = await coordinator.generateFromTranscript("Crystal Atrium");

    expect(result).toBe(world);
    expect(api.startTextToWorldJob).toHaveBeenCalledWith("Crystal Atrium");
    expect(api.voiceToWorld).not.toHaveBeenCalled();
    expect(state.current).toBe("Ready");
    expect(progressMessages).toEqual(["Generating world.", "World ready."]);
    expect(rendererCalls).toEqual(["world_123", "show"]);
  });

  it("sets an error for empty audio without calling the API or renderer", async () => {
    const state = new HolodeckStateMachine();
    const api: HolodeckApi = {
      voiceToWorld: vi.fn(),
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({ state, api, renderer });

    await coordinator.generateFromAudio(new Blob([]));

    expect(state.current).toBe("Error");
    expect(state.errorMessage).toBe("No audio was captured.");
    expect(api.voiceToWorld).not.toHaveBeenCalled();
    expect(rendererCalls).toEqual([]);
  });

  it("sets an error when the API rejects without loading or showing", async () => {
    const state = new HolodeckStateMachine();
    const api: HolodeckApi = {
      voiceToWorld: async () => {
        throw new Error("Transcription failed");
      },
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({ state, api, renderer });

    await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(state.current).toBe("Error");
    expect(state.errorMessage).toBe("Transcription failed");
    expect(rendererCalls).toEqual([]);
  });

  it("sets an error when renderer loading fails and does not show", async () => {
    const state = new HolodeckStateMachine();
    const api: HolodeckApi = {
      voiceToWorld: async () => createWorld(),
    };
    const rendererCalls: string[] = [];
    const renderer: WorldRenderer = {
      ...createRenderer(rendererCalls),
      load: async (loadedWorld) => {
        rendererCalls.push(loadedWorld.worldId);
        throw new Error("Panorama failed to load");
      },
    };
    const coordinator = new VoiceToWorldCoordinator({ state, api, renderer });

    await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(state.current).toBe("Error");
    expect(state.errorMessage).toBe("Panorama failed to load");
    expect(rendererCalls).toEqual(["world_123"]);
  });

  it("rejects concurrent generation attempts while one is active", async () => {
    const state = new HolodeckStateMachine();
    const world = createWorld();
    let resolveFirst!: (world: WorldResult) => void;
    const firstCall = new Promise<WorldResult>((resolve) => {
      resolveFirst = resolve;
    });
    const api: HolodeckApi = {
      voiceToWorld: vi.fn().mockReturnValue(firstCall),
    };
    const rendererCalls: string[] = [];
    const renderer = createRenderer(rendererCalls);
    const coordinator = new VoiceToWorldCoordinator({ state, api, renderer });

    const firstGeneration = coordinator.generateFromAudio(new Blob(["first"]));
    await coordinator.generateFromAudio(new Blob(["second"]));

    expect(api.voiceToWorld).toHaveBeenCalledTimes(1);
    expect(state.current).toBe("Error");
    expect(state.errorMessage).toBe("World generation is already running.");
    expect(rendererCalls).toEqual([]);

    resolveFirst(world);
    await firstGeneration;

    expect(api.voiceToWorld).toHaveBeenCalledTimes(1);
    expect(state.current).toBe("Ready");
    expect(rendererCalls).toEqual(["world_123", "show"]);
  });
});
