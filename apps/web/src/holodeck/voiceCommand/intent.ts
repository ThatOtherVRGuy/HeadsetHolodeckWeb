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

export type VoiceCommandTarget = "world" | "me";
export type VoiceVisibilityTarget = "holodeck" | "arch";
export type VoiceCommandAxis = "x" | "y" | "z";

export type VoiceCommandIntent =
  | {
      kind: "endProgram";
      response: string;
    }
  | {
      kind: "setVisibility";
      target: VoiceVisibilityTarget;
      visible: boolean;
      response: string;
    }
  | {
      kind: "transformObject";
      target: VoiceCommandTarget;
      operation: "resetTransform";
      response: string;
    }
  | {
      kind: "transformObject";
      target: VoiceCommandTarget;
      operation: "recenter";
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

  const visibilityIntent = parseVisibilityIntent(text);
  if (visibilityIntent) {
    return visibilityIntent;
  }

  const target = targetForText(text);
  if (!target) {
    return null;
  }

  return (
    parseResetTransformIntent(text, target) ??
    parseRecenterIntent(text, target) ??
    parseMoveIntent(text, target) ??
    parseRotateIntent(text, target) ??
    parseScaleIntent(text, target)
  );
}

export function looksLikeVoiceCommandAttempt(text: string): boolean {
  return (
    parseVisibilityIntent(text) !== null ||
    visibilityForText(text) !== null ||
    targetForText(text) !== null ||
    /\b(move|shift|translate|raise|lower|rotate|turn|spin|scale|resize|grow|shrink|reset|restore|recenter|re-center|center|centre)\b/i.test(
      text
    ) ||
    /\b(the arch|holodeck|archway|doorway|my view|my position)\b/i.test(text)
  );
}

export function looksLikeWorldGenerationPrompt(text: string): boolean {
  if (hasExplicitWorldGenerationRequest(text)) {
    return true;
  }

  if (looksLikeVoiceCommandAttempt(text)) {
    return false;
  }

  return hasDescriptiveSceneSubject(text);
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

function parseVisibilityIntent(text: string): VoiceCommandIntent | null {
  const visible = visibilityForText(text);
  if (visible === null) {
    return null;
  }

  const target = visibilityTargetForText(text);
  if (!target) {
    return null;
  }

  return {
    kind: "setVisibility",
    target,
    visible,
    response: `${visible ? "Showing" : "Hiding"} ${visibilityTargetLabel(target)}.`
  };
}

function visibilityForText(text: string): boolean | null {
  if (/\b(show|display|reveal|restore|enable)\b/i.test(text)) {
    return true;
  }

  if (/\b(hide|dismiss|remove|disable)\b/i.test(text)) {
    return false;
  }

  return null;
}

function visibilityTargetForText(text: string): VoiceVisibilityTarget | null {
  if (/\b(arch|archway|doorway)\b/i.test(text)) {
    return "arch";
  }

  if (/\bholodeck|room|static room|environment shell\b/i.test(text)) {
    return "holodeck";
  }

  return null;
}

function hasExplicitWorldGenerationRequest(text: string): boolean {
  return (
    /\b(create|generate|build|make|render)\b.+\b(world|scene|environment|place|room|landscape|panorama|splat)\b/i.test(
      text
    ) ||
    /\b(put|place|drop|take|transport)\s+me\s+(in|into|inside|to)\b/i.test(text) ||
    /\b(show)\s+me\s+(a|an|the)\b/i.test(text)
  );
}

function hasDescriptiveSceneSubject(text: string): boolean {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) {
    return false;
  }

  return /\b(park|forest|city|street|room|hall|circus|beach|mountain|valley|desert|island|garden|castle|labyrinth|lounge|museum|station|ship|planet|world|scene|landscape)\b/i.test(
    trimmed
  );
}

function parseMoveIntent(
  text: string,
  target: VoiceCommandTarget
): VoiceCommandIntent | null {
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
    target,
    operation: "move",
    axis: direction.axis,
    direction: direction.sign,
    amount,
    response: `Moving ${targetLabel(target)} ${direction.label} ${amount.originalPhrase}.`
  };
}

function parseResetTransformIntent(
  text: string,
  target: VoiceCommandTarget
): VoiceCommandIntent | null {
  if (
    !(
      /\b(reset|restore)\s+(the\s+)?(world|scene|environment|it|me|myself|player|rig|camera|view|viewpoint)\b/i.test(
        text
      ) ||
      /\b(reset|restore)\s+(my|mine)\s+(position|pose|view|viewpoint|camera|rig)\b/i.test(
        text
      ) ||
      /\b(world|scene|environment|it|me|myself|player|rig|camera|view|viewpoint)\s+(transform|pose|position|rotation|scale)?\s*(reset|restore)\b/i.test(
        text
      )
    )
  ) {
    return null;
  }

  return {
    kind: "transformObject",
    target,
    operation: "resetTransform",
    response: `Resetting ${targetLabel(target)} transform.`
  };
}

function parseRecenterIntent(
  text: string,
  target: VoiceCommandTarget
): VoiceCommandIntent | null {
  if (
    !(
      /\b(recenter|re-center|center|centre)\s+(the\s+)?(world|scene|environment|it|me|myself|player|rig|camera|view|viewpoint)\b/i.test(
        text
      ) ||
      /\b(recenter|re-center|center|centre)\s+(my|mine)\s+(position|pose|view|viewpoint|camera|rig)\b/i.test(
        text
      ) ||
      /\b(world|scene|environment|it|me|myself|player|rig|camera|view|viewpoint)\s+(back\s+)?(to\s+)?(the\s+)?(center|centre)\b/i.test(
        text
      )
    )
  ) {
    return null;
  }

  return {
    kind: "transformObject",
    target,
    operation: "recenter",
    response: `Recentering ${targetLabel(target)}.`
  };
}

function parseRotateIntent(
  text: string,
  target: VoiceCommandTarget
): VoiceCommandIntent | null {
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
    target,
    operation: "rotate",
    axis,
    amount,
    response: `Rotating ${targetLabel(target)} ${amount.originalPhrase} on ${axisLabel(axis)} axis.`
  };
}

function parseScaleIntent(
  text: string,
  target: VoiceCommandTarget
): VoiceCommandIntent | null {
  if (target !== "world") {
    return null;
  }

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

function targetForText(text: string): VoiceCommandTarget | null {
  if (referencesMeTarget(text)) {
    return "me";
  }

  if (/\b(world|scene|environment|it)\b/i.test(text)) {
    return "world";
  }

  return null;
}

function referencesMeTarget(text: string): boolean {
  return (
    /\b(me|myself|player|rig|xr rig|camera|viewpoint)\b/i.test(text) ||
    /\b(my|mine)\s+(position|pose|view|viewpoint|camera|rig)\b/i.test(text)
  );
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

function targetLabel(target: VoiceCommandTarget): string {
  return target === "me" ? "me" : "world";
}

function visibilityTargetLabel(target: VoiceVisibilityTarget): string {
  return target === "holodeck" ? "holodeck" : "arch";
}
