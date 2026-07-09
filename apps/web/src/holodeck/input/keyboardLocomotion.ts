export type MovementAxis = {
  x: number;
  y: number;
};

const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export function movementAxisForKeys(keys: ReadonlySet<string>): MovementAxis {
  const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const y = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const magnitude = Math.hypot(x, y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / magnitude,
    y: y / magnitude
  };
}

export class KeyboardLocomotionTracker {
  private readonly pressedKeys = new Set<string>();
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (movementKeys.has(event.code)) {
      this.pressedKeys.add(event.code);
    }
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (movementKeys.has(event.code)) {
      this.pressedKeys.delete(event.code);
    }
  };

  constructor(private readonly target: Window) {
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
  }

  getAxis(): MovementAxis {
    return movementAxisForKeys(this.pressedKeys);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.pressedKeys.clear();
  }
}
