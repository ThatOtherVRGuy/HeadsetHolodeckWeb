export type HolodeckState =
  | "Idle"
  | "ListeningForCommand"
  | "Interpreting"
  | "Generating"
  | "Ready"
  | "Error";

const allowedTransitions: Record<HolodeckState, ReadonlySet<HolodeckState>> = {
  Idle: new Set(["ListeningForCommand", "Generating", "Error"]),
  ListeningForCommand: new Set(["Interpreting", "Idle", "Error"]),
  Interpreting: new Set(["Generating", "Idle", "Error"]),
  Generating: new Set(["Ready", "Idle", "Error"]),
  Ready: new Set(["Idle", "Generating", "Error"]),
  Error: new Set(["Idle"]),
};

export class HolodeckStateMachine {
  current: HolodeckState = "Idle";
  errorMessage = "";

  tryTransitionTo(next: HolodeckState): boolean {
    if (!allowedTransitions[this.current].has(next)) {
      return false;
    }

    this.forceState(next);
    return true;
  }

  forceState(next: HolodeckState): void {
    this.current = next;
    if (next !== "Error") {
      this.errorMessage = "";
    }
  }

  setError(message: string): void {
    this.current = "Error";
    this.errorMessage = message;
  }

  clearErrorAndReturnToIdle(): void {
    this.forceState("Idle");
  }
}
