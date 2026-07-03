import { describe, expect, it, vi } from "vitest";

import { HolodeckStateMachine } from "./holodeckState";

describe("HolodeckStateMachine", () => {
  it("follows the happy path from Idle to Ready", () => {
    const stateMachine = new HolodeckStateMachine();

    expect(stateMachine.current).toBe("Idle");
    expect(stateMachine.tryTransitionTo("ListeningForCommand")).toBe(true);
    expect(stateMachine.current).toBe("ListeningForCommand");
    expect(stateMachine.tryTransitionTo("Interpreting")).toBe(true);
    expect(stateMachine.current).toBe("Interpreting");
    expect(stateMachine.tryTransitionTo("Generating")).toBe(true);
    expect(stateMachine.current).toBe("Generating");
    expect(stateMachine.tryTransitionTo("Ready")).toBe(true);
    expect(stateMachine.current).toBe("Ready");
  });

  it("rejects Idle to Ready and remains Idle", () => {
    const stateMachine = new HolodeckStateMachine();

    expect(stateMachine.tryTransitionTo("Ready")).toBe(false);
    expect(stateMachine.current).toBe("Idle");
  });

  it("sets and clears an error from ListeningForCommand", () => {
    const stateMachine = new HolodeckStateMachine();

    stateMachine.tryTransitionTo("ListeningForCommand");
    stateMachine.setError("Microphone permission denied");

    expect(stateMachine.current).toBe("Error");
    expect(stateMachine.errorMessage).toBe("Microphone permission denied");

    stateMachine.clearErrorAndReturnToIdle();

    expect(stateMachine.current).toBe("Idle");
    expect(stateMachine.errorMessage).toBe("");
  });

  it("notifies subscribers when state changes", () => {
    const stateMachine = new HolodeckStateMachine();
    const listener = vi.fn();

    const unsubscribe = stateMachine.subscribe(listener);
    stateMachine.tryTransitionTo("ListeningForCommand");
    stateMachine.setError("Microphone permission denied");
    unsubscribe();
    stateMachine.clearErrorAndReturnToIdle();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      current: "ListeningForCommand",
      errorMessage: "",
      statusMessage: ""
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      current: "Error",
      errorMessage: "Microphone permission denied",
      statusMessage: ""
    });
  });

  it("stores and notifies a transient status message", () => {
    const stateMachine = new HolodeckStateMachine();
    const listener = vi.fn();

    stateMachine.subscribe(listener);
    stateMachine.setStatusMessage("Rendering splats");

    expect(stateMachine.snapshot()).toEqual({
      current: "Idle",
      errorMessage: "",
      statusMessage: "Rendering splats"
    });
    expect(listener).toHaveBeenCalledWith({
      current: "Idle",
      errorMessage: "",
      statusMessage: "Rendering splats"
    });
  });
});
