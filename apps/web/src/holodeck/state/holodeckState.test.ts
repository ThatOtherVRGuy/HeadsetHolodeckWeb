import { describe, expect, it } from "vitest";

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
});
