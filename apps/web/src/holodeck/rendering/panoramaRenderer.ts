import {
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader
} from "@iwsdk/core/dist/runtime/three.js";
import type { WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

interface PanoramaRendererOptions {
  loadTexture?: (url: string) => Promise<Texture>;
}

export class PanoramaRenderer implements WorldRenderer {
  readonly mode = "panorama" as const;

  private mesh: Mesh | null = null;
  private loadSequence = 0;
  private readonly loadTexture: (url: string) => Promise<Texture>;

  constructor(
    private readonly scene: Object3D,
    options: PanoramaRendererOptions = {}
  ) {
    this.loadTexture =
      options.loadTexture ?? ((url) => new TextureLoader().loadAsync(url));
  }

  async load(world: WorldResult): Promise<void> {
    const sequence = ++this.loadSequence;
    this.disposeCurrentMesh();

    let texture: Texture;
    try {
      texture = await this.loadTexture(world.panoUrl);
    } catch (error) {
      if (sequence !== this.loadSequence) {
        return;
      }

      throw error;
    }
    texture.colorSpace = SRGBColorSpace;

    const geometry = new SphereGeometry(50, 64, 32);
    geometry.scale(-1, 1, 1);

    const material = new MeshBasicMaterial({
      map: texture
    });

    if (sequence !== this.loadSequence) {
      geometry.dispose();
      disposeMaterial(material);
      return;
    }

    this.mesh = new Mesh(geometry, material);
    this.mesh.name = `WorldPanorama_${world.worldId || "unknown"}`;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  show(): void {
    if (this.mesh) {
      this.mesh.visible = true;
    }
  }

  hide(): void {
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  getTransformTarget(): Object3D | null {
    return this.mesh;
  }

  dispose(): void {
    this.loadSequence++;
    this.disposeCurrentMesh();
  }

  private disposeCurrentMesh(): void {
    if (!this.mesh) {
      return;
    }

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();

    const material = this.mesh.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else {
      disposeMaterial(material);
    }

    this.mesh = null;
  }
}

function disposeMaterial(material: Material): void {
  const withMap = material as Material & { map?: Texture };
  withMap.map?.dispose();
  material.dispose();
}
