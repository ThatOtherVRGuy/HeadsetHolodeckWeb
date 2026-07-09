export type MovementAxis = {
  x: number;
  y: number;
};

const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
const verticalKeys = new Set(["KeyE", "KeyC"]);
const yawKeys = new Set(["ArrowLeft", "ArrowRight"]);
const speedMultiplierKeys = new Set(["ShiftLeft", "ShiftRight"]);

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

export function keyboardSpeedMultiplierForKeys(keys: ReadonlySet<string>): number {
  return keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2 : 1;
}

export function verticalAxisForKeys(keys: ReadonlySet<string>): number {
  return (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyC") ? 1 : 0);
}

export function yawAxisForKeys(keys: ReadonlySet<string>): number {
  return (keys.has("ArrowLeft") ? 1 : 0) -
    (keys.has("ArrowRight") ? 1 : 0);
}

export class KeyboardLocomotionTracker {
  private readonly pressedKeys = new Set<string>();
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (isTrackedNavigationKey(event.code)) {
      this.pressedKeys.add(event.code);
    }
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (isTrackedNavigationKey(event.code)) {
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

  getSpeedMultiplier(): number {
    return keyboardSpeedMultiplierForKeys(this.pressedKeys);
  }

  getVerticalAxis(): number {
    return verticalAxisForKeys(this.pressedKeys);
  }

  getYawAxis(): number {
    return yawAxisForKeys(this.pressedKeys);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.pressedKeys.clear();
  }
}

function isTrackedNavigationKey(code: string): boolean {
  return (
    movementKeys.has(code) ||
    verticalKeys.has(code) ||
    yawKeys.has(code) ||
    speedMultiplierKeys.has(code)
  );
}
