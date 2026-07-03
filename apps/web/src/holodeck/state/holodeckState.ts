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
  statusMessage: string;
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
  statusMessage = "";
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
    this.statusMessage = "";
    this.notify();
  }

  clearErrorAndReturnToIdle(): void {
    this.statusMessage = "";
    this.forceState("Idle");
  }

  setStatusMessage(message: string): void {
    this.statusMessage = message;
    this.notify();
  }

  subscribe(listener: HolodeckStateListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): HolodeckStateSnapshot {
    return {
      current: this.current,
      errorMessage: this.errorMessage,
      statusMessage: this.statusMessage
    };
  }

  private notify(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
