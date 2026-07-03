import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export function freezeTransformStaticObjects(root: Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
}
