import {
  Vector2,
  Vector3,
  type Object3D
} from "@iwsdk/core/dist/runtime/three.js";
import { cameraRelativeMovement } from "../input/cameraRelativeMovement";
import type { VoiceCommandIntent } from "./intent";

export interface VoiceCommandObjectRegistry {
  world?: Object3D | null;
  me?: Object3D | null;
  camera?: Object3D | null;
  scalePivot?: Vector3;
  initialWorldTransform?: VoiceCommandTransformState | null;
  initialMeTransform?: VoiceCommandTransformState | null;
}

export interface VoiceCommandTransformState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface VoiceCommandExecutionResult {
  ok: boolean;
  message: string;
}

const voiceMoveAxis = new Vector2();
const voiceMoveVector = new Vector3();

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
      message: `${targetNameForIntent(intent)} is not available for voice commands.`
    };
  }

  const initialTransform = initialTransformForIntent(intent, objects);

  switch (intent.operation) {
    case "resetTransform":
      if (!initialTransform) {
        return {
          ok: false,
          message: `${targetNameForIntent(intent)} transform baseline is not available.`
        };
      }
      applyTransformState(target, initialTransform);
      break;
    case "recenter":
      if (!initialTransform) {
        return {
          ok: false,
          message: `${targetNameForIntent(intent)} transform baseline is not available.`
        };
      }
      target.position.set(...initialTransform.position);
      break;
    case "move":
      moveTarget(target, intent, objects);
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
    case "me":
      return objects.me ?? null;
    case "world":
      return objects.world ?? null;
  }
}

function initialTransformForIntent(
  intent: Extract<VoiceCommandIntent, { kind: "transformObject" }>,
  objects: VoiceCommandObjectRegistry
): VoiceCommandTransformState | null {
  switch (intent.target) {
    case "me":
      return objects.initialMeTransform ?? null;
    case "world":
      return objects.initialWorldTransform ?? null;
  }
}

function targetNameForIntent(
  intent: Extract<VoiceCommandIntent, { kind: "transformObject" }>
): string {
  return intent.target === "me" ? "Me" : "World";
}

const DEFAULT_SCALE_PIVOT = new Vector3(0, 0, 0);

function moveTarget(
  target: Object3D,
  intent: Extract<VoiceCommandIntent, { kind: "transformObject"; operation: "move" }>,
  objects: VoiceCommandObjectRegistry
): void {
  if (intent.target !== "me" || intent.axis === "y" || !objects.camera) {
    target.position[intent.axis] += intent.direction * intent.amount.meters;
    return;
  }

  voiceMoveAxis.set(0, 0);
  voiceMoveAxis[intent.axis === "x" ? "x" : "y"] = intent.direction;
  cameraRelativeMovement(voiceMoveAxis, objects.camera, voiceMoveVector);
  target.position.addScaledVector(voiceMoveVector, intent.amount.meters);
}

function scaleObjectAroundPivot(
  target: Object3D,
  factor: number,
  pivot: Vector3
): void {
  target.position.sub(pivot).multiplyScalar(factor).add(pivot);
}

function applyTransformState(
  target: Object3D,
  transform: VoiceCommandTransformState
): void {
  target.position.set(...transform.position);
  target.rotation.set(...transform.rotation);
  target.scale.set(...transform.scale);
}
