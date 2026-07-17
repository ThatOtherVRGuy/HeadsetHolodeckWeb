import { Vector3, type Object3D } from "@iwsdk/core/dist/runtime/three.js";
import type { VoiceCommandIntent } from "./intent";

export interface VoiceCommandObjectRegistry {
  world?: Object3D | null;
  scalePivot?: Vector3;
}

export interface VoiceCommandExecutionResult {
  ok: boolean;
  message: string;
}

export function executeVoiceCommandIntent(
  intent: VoiceCommandIntent,
  objects: VoiceCommandObjectRegistry
): VoiceCommandExecutionResult {
  if (intent.kind !== "transformObject") {
    return {
      ok: false,
      message: "Voice command is not a transform command."
    };
  }

  const target = objectForIntent(intent, objects);

  if (!target) {
    return {
      ok: false,
      message: "World is not available for voice commands."
    };
  }

  switch (intent.operation) {
    case "move":
      target.position[intent.axis] += intent.direction * intent.amount.meters;
      break;
    case "rotate":
      target.rotation[intent.axis] += intent.amount.radians;
      break;
    case "scale":
      scaleObjectAroundPivot(
        target,
        intent.amount.factor,
        objects.scalePivot ?? DEFAULT_SCALE_PIVOT
      );
      target.scale.multiplyScalar(intent.amount.factor);
      break;
  }

  return {
    ok: true,
    message: intent.response
  };
}

function objectForIntent(
  intent: Extract<VoiceCommandIntent, { kind: "transformObject" }>,
  objects: VoiceCommandObjectRegistry
): Object3D | null {
  switch (intent.target) {
    case "world":
      return objects.world ?? null;
  }
}

const DEFAULT_SCALE_PIVOT = new Vector3(0, 0, 0);

function scaleObjectAroundPivot(
  target: Object3D,
  factor: number,
  pivot: Vector3
): void {
  target.position.sub(pivot).multiplyScalar(factor).add(pivot);
}
