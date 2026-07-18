import {
  Object3D,
  PerspectiveCamera
} from "@iwsdk/core/dist/runtime/three.js";
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

  it("moves me forward relative to the camera", () => {
    const me = new Object3D();
    const camera = new PerspectiveCamera();
    camera.rotation.set(0, Math.PI / 2, 0);
    camera.updateMatrixWorld(true);
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "me",
      operation: "move",
      axis: "z",
      direction: -1,
      amount: {
        meters: 2,
        originalValue: 2,
        originalUnit: "meters",
        originalPhrase: "2 meters"
      },
      response: "Moving me forward 2 meters."
    };

    const result = executeVoiceCommandIntent(intent, { me, camera });

    expect(result).toEqual({
      ok: true,
      message: "Moving me forward 2 meters."
    });
    expect(me.position.x).toBeCloseTo(-2);
    expect(me.position.y).toBeCloseTo(0);
    expect(me.position.z).toBeCloseTo(0);
  });

  it("moves me vertically without requiring a camera", () => {
    const me = new Object3D();
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "me",
      operation: "move",
      axis: "y",
      direction: 1,
      amount: {
        meters: 1,
        originalValue: 1,
        originalUnit: "meter",
        originalPhrase: "1 meter"
      },
      response: "Moving me up 1 meter."
    };

    executeVoiceCommandIntent(intent, { me });

    expect(me.position.toArray()).toEqual([0, 1, 0]);
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

  it("resets the world to its captured initial transform", () => {
    const world = new Object3D();
    world.position.set(4, 5, 6);
    world.rotation.set(0.1, 0.2, 0.3);
    world.scale.set(2, 3, 4);
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "resetTransform",
      response: "Resetting world transform."
    };

    const result = executeVoiceCommandIntent(intent, {
      world,
      initialWorldTransform: {
        position: [1, 2, 3],
        rotation: [0.4, 0.5, 0.6],
        scale: [7, 8, 9]
      }
    });

    expect(result).toEqual({
      ok: true,
      message: "Resetting world transform."
    });
    expect(world.position.toArray()).toEqual([1, 2, 3]);
    expect([world.rotation.x, world.rotation.y, world.rotation.z]).toEqual([
      0.4,
      0.5,
      0.6
    ]);
    expect(world.scale.toArray()).toEqual([7, 8, 9]);
  });

  it("recenters the world position while preserving scale and rotation", () => {
    const world = new Object3D();
    world.position.set(4, 5, 6);
    world.rotation.set(0.1, 0.2, 0.3);
    world.scale.set(2, 3, 4);
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "recenter",
      response: "Recentering world."
    };

    executeVoiceCommandIntent(intent, {
      world,
      initialWorldTransform: {
        position: [1, 2, 3],
        rotation: [0.4, 0.5, 0.6],
        scale: [7, 8, 9]
      }
    });

    expect(world.position.toArray()).toEqual([1, 2, 3]);
    expect([world.rotation.x, world.rotation.y, world.rotation.z]).toEqual([
      0.1,
      0.2,
      0.3
    ]);
    expect(world.scale.toArray()).toEqual([2, 3, 4]);
  });

  it("resets me to the captured initial transform", () => {
    const me = new Object3D();
    me.position.set(4, 5, 6);
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "me",
      operation: "resetTransform",
      response: "Resetting me transform."
    };

    executeVoiceCommandIntent(intent, {
      me,
      initialMeTransform: {
        position: [1, 2, 3],
        rotation: [0.4, 0.5, 0.6],
        scale: [1, 1, 1]
      }
    });

    expect(me.position.toArray()).toEqual([1, 2, 3]);
    expect([me.rotation.x, me.rotation.y, me.rotation.z]).toEqual([
      0.4,
      0.5,
      0.6
    ]);
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

  it("reports a missing initial transform for reset commands", () => {
    const world = new Object3D();
    const intent: VoiceCommandIntent = {
      kind: "transformObject",
      target: "world",
      operation: "resetTransform",
      response: "Resetting world transform."
    };

    expect(executeVoiceCommandIntent(intent, { world })).toEqual({
      ok: false,
      message: "World transform baseline is not available."
    });
  });
});
