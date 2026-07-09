import { describe, expect, it } from "vitest";

import {
  keyboardSpeedMultiplierForKeys,
  movementAxisForKeys,
  verticalAxisForKeys,
  yawAxisForKeys
} from "./keyboardLocomotion";

describe("movementAxisForKeys", () => {
  it.each([
    ["KeyW", { x: 0, y: -1 }],
    ["KeyA", { x: -1, y: 0 }],
    ["KeyS", { x: 0, y: 1 }],
    ["KeyD", { x: 1, y: 0 }]
  ])("maps %s to its own movement axis", (key, expected) => {
    expect(movementAxisForKeys(new Set([key]))).toEqual(expected);
  });

  it("normalizes diagonal movement", () => {
    const axis = movementAxisForKeys(new Set(["KeyW", "KeyD"]));

    expect(axis.x).toBeCloseTo(Math.SQRT1_2);
    expect(axis.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it("cancels opposing keys", () => {
    expect(movementAxisForKeys(new Set(["KeyW", "KeyS"]))).toEqual({ x: 0, y: 0 });
    expect(movementAxisForKeys(new Set(["KeyA", "KeyD"]))).toEqual({ x: 0, y: 0 });
  });
});

describe("keyboardSpeedMultiplierForKeys", () => {
  it("uses normal speed without shift", () => {
    expect(keyboardSpeedMultiplierForKeys(new Set(["KeyW"]))).toBe(1);
  });

  it("uses double speed while either shift key is held", () => {
    expect(keyboardSpeedMultiplierForKeys(new Set(["ShiftLeft"]))).toBe(2);
    expect(keyboardSpeedMultiplierForKeys(new Set(["ShiftRight"]))).toBe(2);
  });
});

describe("verticalAxisForKeys", () => {
  it("maps E upward and C downward", () => {
    expect(verticalAxisForKeys(new Set(["KeyE"]))).toBe(1);
    expect(verticalAxisForKeys(new Set(["KeyC"]))).toBe(-1);
  });

  it("cancels opposing vertical keys", () => {
    expect(verticalAxisForKeys(new Set(["KeyE", "KeyC"]))).toBe(0);
  });
});

describe("yawAxisForKeys", () => {
  it("maps arrow keys to left and right yaw", () => {
    expect(yawAxisForKeys(new Set(["ArrowLeft"]))).toBe(1);
    expect(yawAxisForKeys(new Set(["ArrowRight"]))).toBe(-1);
  });

  it("cancels opposing yaw keys", () => {
    expect(yawAxisForKeys(new Set(["ArrowLeft", "ArrowRight"]))).toBe(0);
  });
});
