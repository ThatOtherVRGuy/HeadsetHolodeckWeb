import { describe, expect, it } from "vitest";

import { movementAxisForKeys } from "./keyboardLocomotion";

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
