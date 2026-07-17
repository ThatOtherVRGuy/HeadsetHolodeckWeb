import type {
  AngleAmount,
  DistanceAmount,
  ScaleAmount
} from "./units";
import {
  parseAngleAmount,
  parseDistanceAmount,
  parseScaleAmount
} from "./units";

export type VoiceCommandTarget = "world";
export type VoiceCommandAxis = "x" | "y" | "z";

export type VoiceCommandIntent =
  | {
      kind: "endProgram";
      response: string;
    }
  | {
      kind: "transformObject";
      target: VoiceCommandTarget;
      operation: "move";
      axis: VoiceCommandAxis;
      direction: 1 | -1;
      amount: DistanceAmount;
      response: string;
    }
  | {
      kind: "transformObject";
      target: VoiceCommandTarget;
      operation: "rotate";
      axis: VoiceCommandAxis;
      amount: AngleAmount;
      response: string;
    }
  | {
      kind: "transformObject";
      target: VoiceCommandTarget;
      operation: "scale";
      amount: ScaleAmount;
      response: string;
    };

export function parseVoiceCommandIntent(text: string): VoiceCommandIntent | null {
  const endProgramIntent = parseEndProgramIntent(text);
  if (endProgramIntent) {
    return endProgramIntent;
  }

  if (!referencesWorldTarget(text)) {
    return null;
  }

  return parseMoveIntent(text) ?? parseRotateIntent(text) ?? parseScaleIntent(text);
}

function parseEndProgramIntent(text: string): VoiceCommandIntent | null {
  if (!/\b(end|terminate|stop|close|exit)\s+(the\s+)?program\b/i.test(text)) {
    return null;
  }

  return {
    kind: "endProgram",
    response: "Ending program."
  };
}

function parseMoveIntent(text: string): VoiceCommandIntent | null {
  if (!/\b(move|shift|translate|raise|lower)\b/i.test(text)) {
    return null;
  }

  const amount = parseDistanceAmount(text);
  const direction = directionForMove(text);

  if (!amount || !direction) {
    return null;
  }

  return {
    kind: "transformObject",
    target: "world",
    operation: "move",
    axis: direction.axis,
    direction: direction.sign,
    amount,
    response: `Moving world ${direction.label} ${amount.originalPhrase}.`
  };
}

function parseRotateIntent(text: string): VoiceCommandIntent | null {
  if (!/\b(rotate|turn|spin)\b/i.test(text)) {
    return null;
  }

  const amount = parseAngleAmount(text);
  if (!amount) {
    return null;
  }

  const axis = axisForRotation(text);
  return {
    kind: "transformObject",
    target: "world",
    operation: "rotate",
    axis,
    amount,
    response: `Rotating world ${amount.originalPhrase} on ${axisLabel(axis)} axis.`
  };
}

function parseScaleIntent(text: string): VoiceCommandIntent | null {
  if (!/\b(make|scale|resize|grow|shrink)\b/i.test(text)) {
    return null;
  }

  const amount = parseScaleAmount(text);
  if (!amount) {
    return null;
  }

  return {
    kind: "transformObject",
    target: "world",
    operation: "scale",
    amount,
    response: `Scaling world ${amount.originalPhrase}.`
  };
}

function referencesWorldTarget(text: string): boolean {
  return /\b(world|scene|environment|it)\b/i.test(text);
}

function directionForMove(text: string):
  | { axis: VoiceCommandAxis; sign: 1 | -1; label: string }
  | null {
  if (/\b(up|higher|raise)\b/i.test(text)) {
    return { axis: "y", sign: 1, label: "up" };
  }

  if (/\b(down|lower)\b/i.test(text)) {
    return { axis: "y", sign: -1, label: "down" };
  }

  if (/\b(right)\b/i.test(text)) {
    return { axis: "x", sign: 1, label: "right" };
  }

  if (/\b(left)\b/i.test(text)) {
    return { axis: "x", sign: -1, label: "left" };
  }

  if (/\b(backward|backwards|back)\b/i.test(text)) {
    return { axis: "z", sign: 1, label: "back" };
  }

  if (/\b(forward|forwards)\b/i.test(text)) {
    return { axis: "z", sign: -1, label: "forward" };
  }

  return null;
}

function axisForRotation(text: string): VoiceCommandAxis {
  if (/\b(x|x-axis|x axis)\b/i.test(text)) {
    return "x";
  }

  if (/\b(z|z-axis|z axis)\b/i.test(text)) {
    return "z";
  }

  return "y";
}

function axisLabel(axis: VoiceCommandAxis): string {
  return axis === "y" ? "up" : axis;
}
