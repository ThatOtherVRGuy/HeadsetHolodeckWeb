import {
  Object3D,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";

export type HolodeckComposeTargetKind = "panel" | "spawn" | "anchor" | "world";

export interface HolodeckComposeTarget {
  name: string;
  kind: HolodeckComposeTargetKind;
  object: Object3D;
}

export interface HolodeckComposeTransform {
  position: [number, number, number];
  rotationDegrees: [number, number, number];
  scale: [number, number, number];
}

export interface HolodeckComposeSnapshot {
  version: 1;
  targets: Record<string, HolodeckComposeTransform & {
    kind: HolodeckComposeTargetKind;
  }>;
}

export interface HolodeckComposeSetOptions {
  position?: [number, number, number];
  rotationDegrees?: [number, number, number];
  scale?: number | [number, number, number];
}

export interface HolodeckComposeController {
  list(): Array<HolodeckComposeTransform & {
    name: string;
    kind: HolodeckComposeTargetKind;
  }>;
  nudge(name: string, x: number, y: number, z: number): HolodeckComposeTransform;
  rotate(name: string, xDegrees: number, yDegrees: number, zDegrees: number): HolodeckComposeTransform;
  scale(name: string, value: number | [number, number, number]): HolodeckComposeTransform;
  set(name: string, options: HolodeckComposeSetOptions): HolodeckComposeTransform;
  snapshot(): HolodeckComposeSnapshot;
  download(filename?: string): void;
}

const ROUND_DECIMALS = 4;
const nudgeVector = new Vector3();

export function isHolodeckComposeModeEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get("compose");
  return value === "1" || value === "true";
}

export function createHolodeckComposeController(
  targets: HolodeckComposeTarget[],
  ownerDocument: Document | null = typeof document === "undefined"
    ? null
    : document
): HolodeckComposeController {
  const targetMap = new Map(targets.map((target) => [target.name, target]));

  const targetOrThrow = (name: string) => {
    const target = targetMap.get(name);
    if (!target) {
      throw new Error(`Unknown compose target ${name}.`);
    }

    return target;
  };

  const controller: HolodeckComposeController = {
    list: () =>
      targets.map((target) => ({
        name: target.name,
        kind: target.kind,
        ...transformForObject(target.object)
      })),
    nudge: (name, x, y, z) => {
      const target = targetOrThrow(name);
      target.object.position.add(nudgeVector.set(x, y, z));
      target.object.updateMatrixWorld(true);
      return transformForObject(target.object);
    },
    rotate: (name, xDegrees, yDegrees, zDegrees) => {
      const target = targetOrThrow(name);
      target.object.rotation.x += degreesToRadians(xDegrees);
      target.object.rotation.y += degreesToRadians(yDegrees);
      target.object.rotation.z += degreesToRadians(zDegrees);
      target.object.updateMatrixWorld(true);
      return transformForObject(target.object);
    },
    scale: (name, value) => {
      const target = targetOrThrow(name);
      applyScale(target.object, value);
      target.object.updateMatrixWorld(true);
      return transformForObject(target.object);
    },
    set: (name, options) => {
      const target = targetOrThrow(name);
      if (options.position) {
        target.object.position.set(...options.position);
      }

      if (options.rotationDegrees) {
        target.object.rotation.set(
          degreesToRadians(options.rotationDegrees[0]),
          degreesToRadians(options.rotationDegrees[1]),
          degreesToRadians(options.rotationDegrees[2])
        );
      }

      if (options.scale !== undefined) {
        applyScale(target.object, options.scale);
      }

      target.object.updateMatrixWorld(true);
      return transformForObject(target.object);
    },
    snapshot: () => {
      const snapshot: HolodeckComposeSnapshot = {
        version: 1,
        targets: {}
      };

      for (const target of targets) {
        snapshot.targets[target.name] = {
          kind: target.kind,
          ...transformForObject(target.object)
        };
      }

      return snapshot;
    },
    download: (filename = "holodeck-compose-overrides.json") => {
      if (!ownerDocument) {
        throw new Error("Compose snapshot download requires a browser document.");
      }

      const json = JSON.stringify(controller.snapshot(), null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = ownerDocument.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return controller;
}

function transformForObject(object: Object3D): HolodeckComposeTransform {
  return {
    position: [
      round(object.position.x),
      round(object.position.y),
      round(object.position.z)
    ],
    rotationDegrees: [
      round(radiansToDegrees(object.rotation.x)),
      round(radiansToDegrees(object.rotation.y)),
      round(radiansToDegrees(object.rotation.z))
    ],
    scale: [
      round(object.scale.x),
      round(object.scale.y),
      round(object.scale.z)
    ]
  };
}

function applyScale(object: Object3D, value: number | [number, number, number]): void {
  if (typeof value === "number") {
    object.scale.setScalar(value);
    return;
  }

  object.scale.set(...value);
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function round(value: number): number {
  const factor = 10 ** ROUND_DECIMALS;
  return Math.round(value * factor) / factor;
}
