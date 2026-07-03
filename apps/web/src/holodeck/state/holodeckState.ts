export type HolodeckState =
  | "Idle"
  | "ListeningForCommand"
  | "Interpreting"
  | "Generating"
  | "Ready"
  | "Error";

export interface HolodeckStateSnapshot {
  current: HolodeckState;
  errorMessage: string;
}

type HolodeckStateListener = (snapshot: HolodeckStateSnapshot) => void;

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
  private readonly listeners = new Set<HolodeckStateListener>();

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
    this.notify();
  }

  setError(message: string): void {
    this.current = "Error";
    this.errorMessage = message;
    this.notify();
  }

  clearErrorAndReturnToIdle(): void {
    this.forceState("Idle");
  }

  subscribe(listener: HolodeckStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): HolodeckStateSnapshot {
    return {
      current: this.current,
      errorMessage: this.errorMessage
    };
  }

  private notify(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
