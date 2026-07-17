import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import type {
  Box3,
  Object3D,
  Vector3,
  WebGLRenderer
} from "@iwsdk/core/dist/runtime/three.js";
import type { SplatPlacement, WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

interface SplatRendererOptions {
  SparkRendererCtor?: typeof SparkRenderer;
  SplatMeshCtor?: typeof SplatMesh;
  onStatus?: (message: string, world: WorldResult) => void;
  onFrame?: (frame: SplatFrameDiagnostics, world: WorldResult) => void;
}

const DEFAULT_SPLAT_SCALE_MULTIPLIER = 8;

export interface SplatFrameDiagnostics {
  policy: SplatPlacement;
  scaleMultiplier: number;
  skippedReason?: string;
  maxDimension?: number;
  finalScale?: [number, number, number];
  finalPosition?: [number, number, number];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export class SplatRenderer implements WorldRenderer {
  readonly mode = "splat";
  private readonly spark: Object3D;
  private readonly SplatMeshCtor: typeof SplatMesh;
  private currentMesh: SplatMesh | null = null;
  private loadSequence = 0;
  private disposed = false;

  constructor(
    private readonly scene: Object3D,
    webGlRenderer: WebGLRenderer,
    private readonly options: SplatRendererOptions = {}
  ) {
    const SparkRendererCtor = options.SparkRendererCtor ?? SparkRenderer;
    this.SplatMeshCtor = options.SplatMeshCtor ?? SplatMesh;
    this.spark = new SparkRendererCtor({
      renderer: webGlRenderer,
      enableLod: true
    }) as Object3D;
    this.spark.name = "HolodeckSparkRenderer";
    this.scene.add(this.spark);
  }

  async load(world: WorldResult) {
    if (this.disposed) {
      throw new Error("Cannot load a splat after renderer disposal");
    }

    const url = selectSplatUrl(world);

    if (!url) {
      throw new Error(`World ${world.worldId} did not include a splat URL`);
    }

    const sequence = ++this.loadSequence;
    const mesh = new this.SplatMeshCtor({
      url,
      lod: true,
      onProgress: (event: ProgressEvent) => {
        this.options.onStatus?.(progressMessageForEvent(event), world);
      }
    });
    mesh.name = `WorldSplat_${world.worldId}`;
    mesh.visible = false;
    mesh.scale.set(
      DEFAULT_SPLAT_SCALE_MULTIPLIER,
      -DEFAULT_SPLAT_SCALE_MULTIPLIER,
      DEFAULT_SPLAT_SCALE_MULTIPLIER
    );

    await mesh.initialized;

    if (sequence !== this.loadSequence || this.disposed) {
      mesh.dispose();
      return;
    }

    this.clearCurrentMesh();
    const frame = frameSplatMesh(mesh, placementPolicyForWorld(world));
    this.options.onFrame?.(frame, world);
    console.info("[Holodeck] splat framed", frame);
    this.currentMesh = mesh;
    this.scene.add(mesh);
    this.options.onStatus?.(loadedMessageForMesh(mesh), world);
  }

  show() {
    if (this.currentMesh) {
      this.currentMesh.visible = true;
    }
  }

  hide() {
    if (this.currentMesh) {
      this.currentMesh.visible = false;
    }
  }

  getTransformTarget(): Object3D | null {
    return this.currentMesh;
  }

  dispose() {
    this.disposed = true;
    this.loadSequence += 1;
    this.clearCurrentMesh();
    this.scene.remove(this.spark);
    disposeObject(this.spark);
  }

  private clearCurrentMesh() {
    if (!this.currentMesh) {
      return;
    }

    this.scene.remove(this.currentMesh);
    this.currentMesh.dispose();
    this.currentMesh = null;
  }
}

export function selectSplatUrl(world: WorldResult) {
  if (world.localSplat?.publicUrl) {
    return world.localSplat.publicUrl;
  }

  return (
    world.spzUrls.full_res ??
    world.spzUrls["500k"] ??
    world.spzUrls["150k"] ??
    world.spzUrls["100k"] ??
    Object.values(world.spzUrls).find((url) => url.trim().length > 0) ??
    null
  );
}

function disposeObject(object: Object3D) {
  const disposable = object as Object3D & { dispose?: () => void };
  disposable.dispose?.();
}

function progressMessageForEvent(event: ProgressEvent) {
  if (event.lengthComputable && event.total > 0) {
    const percent = Math.min(100, Math.floor((event.loaded / event.total) * 100));
    return `Loading local splat ${percent}%`;
  }

  return `Loading local splat ${formatBytes(event.loaded)}`;
}

function loadedMessageForMesh(mesh: SplatMesh) {
  const splatCount = typeof mesh.numSplats === "number" ? mesh.numSplats : 0;
  return splatCount > 0
    ? `Local splat decoded: ${splatCount.toLocaleString()} splats`
    : "Local splat decoded";
}

function placementPolicyForWorld(world: WorldResult): SplatPlacement {
  if (world.localSplat?.placement) {
    return world.localSplat.placement;
  }

  const raw = world.raw as { source?: unknown } | null;
  return raw?.source === "browser-file-spz" ? "loose-object" : "world";
}

function frameSplatMesh(
  mesh: SplatMesh,
  policy: SplatPlacement
): SplatFrameDiagnostics {
  const bounds = mesh.getBoundingBox(true);
  if (!isUsableBounds(bounds)) {
    return skippedSplatFrameDiagnostics(bounds, policy, "unusable-bounds");
  }

  const center = bounds.getCenter(mesh.position as Vector3);
  const size = bounds.getSize(mesh.scale as Vector3);
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return skippedSplatFrameDiagnostics(bounds, policy, "invalid-max-dimension");
  }

  const scale =
    Math.min(1, (policy === "loose-object" ? 2 : 6) / maxDimension) *
    DEFAULT_SPLAT_SCALE_MULTIPLIER;
  mesh.scale.set(scale, -scale, scale);
  if (policy === "loose-object") {
    mesh.position.set(-center.x * scale, 1.2 + center.y * scale, -center.z * scale);
    return splatFrameDiagnostics(mesh, bounds, policy, maxDimension);
  }

  mesh.position.set(-center.x * scale, bounds.max.y * scale, -center.z * scale);
  return splatFrameDiagnostics(mesh, bounds, policy, maxDimension);
}

function isUsableBounds(bounds: Box3) {
  return (
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.min.y) &&
    Number.isFinite(bounds.min.z) &&
    Number.isFinite(bounds.max.x) &&
    Number.isFinite(bounds.max.y) &&
    Number.isFinite(bounds.max.z)
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function splatFrameDiagnostics(
  mesh: SplatMesh,
  bounds: Box3,
  policy: SplatPlacement,
  maxDimension: number
): SplatFrameDiagnostics {
  return {
    policy,
    maxDimension,
    scaleMultiplier: DEFAULT_SPLAT_SCALE_MULTIPLIER,
    finalScale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    finalPosition: [mesh.position.x, mesh.position.y, mesh.position.z],
    bounds: {
      min: [bounds.min.x, bounds.min.y, bounds.min.z],
      max: [bounds.max.x, bounds.max.y, bounds.max.z]
    }
  };
}

function skippedSplatFrameDiagnostics(
  bounds: Box3,
  policy: SplatPlacement,
  skippedReason: string
): SplatFrameDiagnostics {
  return {
    policy,
    scaleMultiplier: DEFAULT_SPLAT_SCALE_MULTIPLIER,
    skippedReason,
    bounds: {
      min: [bounds.min.x, bounds.min.y, bounds.min.z],
      max: [bounds.max.x, bounds.max.y, bounds.max.z]
    }
  };
}
