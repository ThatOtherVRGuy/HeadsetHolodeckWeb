import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { executeVoiceCommandIntent } from "./executor";
import type { VoiceCommandIntent } from "./intent";

describe("executeVoiceCommandIntent", () => {
  it("moves the world by normalized meters while returning original phrasing", () => {
    const world = new Object3D();
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "move",
      axis: "y",
      direction: 1,
      amount: {
        meters: 0.9144,
        originalValue: 3,
        originalUnit: "feet",
        originalPhrase: "3 feet"
      },
      response: "Moving world up 3 feet."
    };

    const result = executeVoiceCommandIntent(intent, { world });

    expect(world.position.y).toBeCloseTo(0.9144);
    expect(result.message).toBe("Moving world up 3 feet.");
  });

  it("rotates the world around the requested axis", () => {
    const world = new Object3D();
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "rotate",
      axis: "z",
      amount: {
        radians: Math.PI / 2,
        degrees: 90,
        originalValue: 90,
        originalUnit: "degrees",
        originalPhrase: "90 degrees"
      },
      response: "Rotating world 90 degrees on z axis."
    };

    executeVoiceCommandIntent(intent, { world });

    expect(world.rotation.z).toBeCloseTo(Math.PI / 2);
  });

  it("scales the world uniformly", () => {
    const world = new Object3D();
    world.position.set(0, 2, 0);
    world.scale.set(2, 3, 4);
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "scale",
      amount: {
        factor: 0.5,
        originalPhrase: "half size"
      },
      response: "Scaling world half size."
    };

    executeVoiceCommandIntent(intent, { world });

    expect(world.scale.toArray()).toEqual([1, 1.5, 2]);
    expect(world.position.toArray()).toEqual([0, 1, 0]);
  });

  it("reports a missing target without throwing", () => {
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "scale",
      amount: {
        factor: 2,
        originalPhrase: "twice as big"
      },
      response: "Scaling world twice as big."
    };

    expect(executeVoiceCommandIntent(intent, {})).toEqual({
      ok: false,
      message: "World is not available for voice commands."
    });
  });
});
