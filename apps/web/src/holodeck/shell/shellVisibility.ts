import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export function setShellVisualsVisible(
  shellRoot: Object3D | null,
  exemptRoots: Array<Object3D | null>,
  visible: boolean
): void {
  if (!shellRoot) {
    return;
  }

  shellRoot.traverse((object) => {
    if (exemptRoots.some((root) => root && isObjectInSubtree(object, root))) {
      return;
    }

    if (isRenderableObject(object)) {
      object.visible = visible;
    }
  });
}

function isObjectInSubtree(object: Object3D, subtreeRoot: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (current === subtreeRoot) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function isRenderableObject(object: Object3D): boolean {
  const renderable = object as Object3D & {
    isLine?: boolean;
    isMesh?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
  };

  return Boolean(
    renderable.isMesh ||
      renderable.isLine ||
      renderable.isPoints ||
      renderable.isSprite
  );
}
