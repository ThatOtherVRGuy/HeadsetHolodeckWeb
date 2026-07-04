import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import type {
  Box3,
  Object3D,
  Vector3,
  WebGLRenderer
} from "@iwsdk/core/dist/runtime/three.js";
import type { WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

interface SplatRendererOptions {
  SparkRendererCtor?: typeof SparkRenderer;
  SplatMeshCtor?: typeof SplatMesh;
  onStatus?: (message: string) => void;
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
        this.options.onStatus?.(progressMessageForEvent(event));
      }
    });
    mesh.name = `WorldSplat_${world.worldId}`;
    mesh.visible = false;
    mesh.scale.set(1, -1, 1);

    await mesh.initialized;

    if (sequence !== this.loadSequence || this.disposed) {
      mesh.dispose();
      return;
    }

    this.clearCurrentMesh();
    frameSplatMesh(mesh);
    this.currentMesh = mesh;
    this.scene.add(mesh);
    this.options.onStatus?.(loadedMessageForMesh(mesh));
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

function frameSplatMesh(mesh: SplatMesh) {
  const bounds = mesh.getBoundingBox(true);
  if (!isUsableBounds(bounds)) {
    return;
  }

  const center = bounds.getCenter(mesh.position as Vector3);
  const size = bounds.getSize(mesh.scale as Vector3);
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return;
  }

  const scale = Math.min(1, 6 / maxDimension);
  mesh.scale.set(scale, -scale, scale);
  mesh.position.set(
    -center.x * scale,
    bounds.max.y * scale,
    -center.z * scale
  );
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
