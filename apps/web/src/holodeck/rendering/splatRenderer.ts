import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import type {
  Object3D,
  Scene,
  WebGLRenderer
} from "@iwsdk/core/dist/runtime/three.js";
import type { WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

interface SplatRendererOptions {
  SparkRendererCtor?: typeof SparkRenderer;
  SplatMeshCtor?: typeof SplatMesh;
}

export class SplatRenderer implements WorldRenderer {
  readonly mode = "splat";
  private readonly spark: Object3D;
  private readonly SplatMeshCtor: typeof SplatMesh;
  private currentMesh: SplatMesh | null = null;
  private loadSequence = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    webGlRenderer: WebGLRenderer,
    options: SplatRendererOptions = {}
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
      lod: "quality"
    });
    mesh.name = `WorldSplat_${world.worldId}`;
    mesh.visible = false;
    mesh.scale.y = -1;

    await mesh.initialized;

    if (sequence !== this.loadSequence || this.disposed) {
      mesh.dispose();
      return;
    }

    this.clearCurrentMesh();
    this.currentMesh = mesh;
    this.scene.add(mesh);
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
