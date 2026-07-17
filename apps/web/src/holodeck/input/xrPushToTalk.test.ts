import { describe, expect, it, vi } from "vitest";
import {
  installKeyboardPushToTalk,
  updateXrPushToTalk,
  type XrPushToTalkGamepad
} from "./xrPushToTalk";

function gamepad(state: {
  buttonDown?: boolean;
  buttonUp?: boolean;
  indexDown?: boolean;
  indexUp?: boolean;
}): XrPushToTalkGamepad {
  return {
    getButtonDown: (id) => id === "b-button" && Boolean(state.buttonDown),
    getButtonUp: (id) => id === "b-button" && Boolean(state.buttonUp),
    getButtonDownByIdx: (index) => index === 5 && Boolean(state.indexDown),
    getButtonUpByIdx: (index) => index === 5 && Boolean(state.indexUp)
  };
}

describe("updateXrPushToTalk", () => {
  it("starts push-to-talk when the B button is pressed", () => {
    const start = vi.fn();
    const stop = vi.fn();

    updateXrPushToTalk(gamepad({ buttonDown: true }), { start, stop });

    expect(start).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it("stops push-to-talk when the B button is released", () => {
    const start = vi.fn();
    const stop = vi.fn();

    updateXrPushToTalk(gamepad({ buttonUp: true }), { start, stop });

    expect(start).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("uses WebXR standard button index 5 as a fallback", () => {
    const start = vi.fn();
    const stop = vi.fn();

    updateXrPushToTalk(gamepad({ indexDown: true, indexUp: true }), {
      start,
      stop
    });

    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe("installKeyboardPushToTalk", () => {
  function keyboardTarget() {
    const listeners = new Map<string, Array<(event: KeyboardEvent) => void>>();
    return {
      addEventListener: vi.fn(
        (type: string, listener: (event: KeyboardEvent) => void) => {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        }
      ),
      removeEventListener: vi.fn(
        (type: string, listener: (event: KeyboardEvent) => void) => {
          listeners.set(
            type,
            (listeners.get(type) ?? []).filter((entry) => entry !== listener)
          );
        }
      ),
      dispatch(type: string, event: Partial<KeyboardEvent>) {
        for (const listener of listeners.get(type) ?? []) {
          listener(event as KeyboardEvent);
        }
      }
    };
  }

  it("starts on keyboard B down and stops on keyboard B up", () => {
    const target = keyboardTarget();
    const start = vi.fn();
    const stop = vi.fn();

    installKeyboardPushToTalk(
      { start, stop },
      { target: target as unknown as Window }
    );

    target.dispatch("keydown", { key: "b", repeat: false });
    target.dispatch("keyup", { key: "b" });

    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("does not restart while the keyboard key is repeating", () => {
    const target = keyboardTarget();
    const start = vi.fn();
    const stop = vi.fn();

    installKeyboardPushToTalk(
      { start, stop },
      { target: target as unknown as Window }
    );

    target.dispatch("keydown", { key: "b", repeat: false });
    target.dispatch("keydown", { key: "b", repeat: true });

    expect(start).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it("removes keyboard listeners on cleanup", () => {
    const target = keyboardTarget();
    const start = vi.fn();
    const stop = vi.fn();

    const cleanup = installKeyboardPushToTalk(
      { start, stop },
      { target: target as unknown as Window }
    );
    cleanup();

    target.dispatch("keydown", { key: "b", repeat: false });
    target.dispatch("keyup", { key: "b" });

    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
