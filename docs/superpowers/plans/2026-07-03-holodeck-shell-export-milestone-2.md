# Holodeck Shell Export Milestone 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable focused Unity-to-IWSDK shell export path and load the exported holodeck shell through a named-anchor contract.

**Architecture:** Keep export documentation, anchor resolution, placement fallback, and shell loading as separate units. The Unity export produces `holodeck-shell.glb` or `holodeck-shell.gltf`; the web runtime resolves required anchors and uses them when present while preserving current debug fallbacks. Generated splats and panoramas remain independent from static shell loading.

**Tech Stack:** Unity 6 reference project, GLB/GLTF export, Meta IWSDK 0.4.2, Three.js via `@iwsdk/core`, TypeScript, Vitest, Vite.

---

## Planned File Structure

- Create `docs/export/holodeck-shell-focused-export.md`: manual export checklist and per-object static-intent log.
- Create `apps/web/src/holodeck/shell/anchorContract.ts`: required anchor names and typed anchor map.
- Create `apps/web/src/holodeck/shell/anchorResolver.ts`: pure `Object3D` tree anchor resolution.
- Test `apps/web/src/holodeck/shell/anchorResolver.test.ts`: anchor success and missing-anchor behavior.
- Create `apps/web/src/holodeck/shell/staticIntent.ts`: helpers to freeze transform-static shell objects.
- Test `apps/web/src/holodeck/shell/staticIntent.test.ts`: recursive matrix freezing behavior.
- Create `apps/web/src/holodeck/shell/placement.ts`: placement targets with exported-anchor preference and debug fallback.
- Test `apps/web/src/holodeck/shell/placement.test.ts`: fallback and anchor-preferred placement behavior.
- Create `apps/web/src/holodeck/shell/shellLoader.ts`: shell asset retrieval, anchor resolution, status result, static transform freezing.
- Test `apps/web/src/holodeck/shell/shellLoader.test.ts`: loader success, missing asset, missing anchors.
- Modify `apps/web/src/index.ts`: add exported shell asset to manifest after asset exists, initialize shell loader, use placement for panel and generated world root.
- Add exported asset under `apps/web/public/assets/unity-export/holodeck-shell/` after manual export.

## Task 0: Create Milestone Branch

**Files:**
- No file changes.

- [ ] **Step 1: Check the current branch and working tree**

Run:

```bash
git branch --show-current
git status --short
```

Expected: current branch is `codex/milestone-1` and working tree is clean.

- [ ] **Step 2: Create the milestone branch**

Run:

```bash
git switch -c codex/milestone-2-shell-export
```

Expected: branch switches to `codex/milestone-2-shell-export`.

## Task 1: Write Focused Unity Export Checklist

**Files:**
- Create: `docs/export/holodeck-shell-focused-export.md`

- [ ] **Step 1: Create the checklist document**

Create `docs/export/holodeck-shell-focused-export.md`:

```markdown
# Focused Holodeck Shell Export Checklist

## Purpose

This checklist captures the exact Unity-to-WebXR export path for the focused static holodeck shell used by HeadsetHolodeckWeb Milestone 2.

The export is intentionally small. It includes the arch/frame, immediate shell or floor geometry, and anchor transforms. It does not include generated worlds, runtime UI logic, physics bodies, full scene parity, or experimental objects.

## Output Location

Copy the final export to:

`apps/web/public/assets/unity-export/holodeck-shell/`

Accepted primary asset names:

- `holodeck-shell.glb`
- `holodeck-shell.gltf`

If `.gltf` is used, keep the `.bin` and texture files in the same folder or direct child folders.

## Required Anchors

Every export must contain nodes with these exact names:

- `WorldRoot`
- `GeneratedWorldRoot`
- `MainStatusPanelAnchor`
- `RecordControlAnchor`
- `UserStartPose`

If empty GameObjects do not survive export, replace them with tiny marker meshes or exporter-compatible nodes that preserve the same names.

## Static Intent Log

Record each exported object and its intended static role.

| Unity Object | Include? | Transform Static | Render Static | Lighting Static | Notes |
| --- | --- | --- | --- | --- | --- |
| WorldRoot | yes | yes | no | no | Anchor/root marker |
| GeneratedWorldRoot | yes | yes | no | no | Runtime generated content parent |
| MainStatusPanelAnchor | yes | yes | no | no | Primary UI anchor |
| RecordControlAnchor | yes | yes | no | no | Recording controls anchor |
| UserStartPose | yes | yes | no | no | Initial player/camera pose |

## Export Steps

1. Open HeadsetHolodeckDev in Unity 6000.2.10f1.
2. Open `Assets/Scenes/Holodeck.unity`.
3. Verify or create the five required anchors.
4. Select only the focused shell geometry and required anchors.
5. Fill in the Static Intent Log above for every selected object.
6. Ensure selected geometry uses web-friendly materials where practical.
7. Export as GLB or GLTF using the available Unity exporter.
8. Open the exported file in an external GLTF viewer or importer.
9. Confirm all five required anchor names are present.
10. Confirm scale and orientation are sane: user height around 1.5-1.8m, forward direction matches the intended generated-world view.
11. Copy the export into `apps/web/public/assets/unity-export/holodeck-shell/`.
12. Run the web app and verify the runtime shell loader reports the shell loaded.

## Validation Notes

Record the actual export result here before committing the asset:

- Export format:
- Exporter/package used:
- Primary asset path:
- Companion files:
- Missing or renamed anchors:
- Scale/orientation issues:
- Material issues:
- Static metadata survived in GLTF extras/userData:
- Runtime loader result:
```

- [ ] **Step 2: Commit the checklist**

Run:

```bash
git add docs/export/holodeck-shell-focused-export.md
git commit -m "docs: add focused shell export checklist"
```

Expected: commit succeeds with only the checklist file.

## Task 2: Add Anchor Contract And Resolver

**Files:**
- Create: `apps/web/src/holodeck/shell/anchorContract.ts`
- Create: `apps/web/src/holodeck/shell/anchorResolver.ts`
- Test: `apps/web/src/holodeck/shell/anchorResolver.test.ts`

- [ ] **Step 1: Write failing anchor resolver tests**

Create `apps/web/src/holodeck/shell/anchorResolver.test.ts`:

```ts
import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { REQUIRED_SHELL_ANCHORS } from "./anchorContract.js";
import { resolveShellAnchors } from "./anchorResolver.js";

function namedObject(name: string) {
  const object = new Object3D();
  object.name = name;
  return object;
}

describe("resolveShellAnchors", () => {
  it("resolves every required anchor from a loaded object tree", () => {
    const root = namedObject("HolodeckShell");
    for (const anchorName of REQUIRED_SHELL_ANCHORS) {
      root.add(namedObject(anchorName));
    }

    const result = resolveShellAnchors(root);

    expect(result.missing).toEqual([]);
    expect(Object.keys(result.anchors).sort()).toEqual(
      [...REQUIRED_SHELL_ANCHORS].sort()
    );
    expect(result.anchors.GeneratedWorldRoot.name).toBe("GeneratedWorldRoot");
  });

  it("reports required anchors that are missing", () => {
    const root = namedObject("HolodeckShell");
    root.add(namedObject("WorldRoot"));
    root.add(namedObject("GeneratedWorldRoot"));

    const result = resolveShellAnchors(root);

    expect(result.anchors.WorldRoot.name).toBe("WorldRoot");
    expect(result.missing).toEqual([
      "MainStatusPanelAnchor",
      "RecordControlAnchor",
      "UserStartPose"
    ]);
  });

  it("finds anchors nested under exported geometry", () => {
    const root = namedObject("HolodeckShell");
    const arch = namedObject("Arch");
    const panelAnchor = namedObject("MainStatusPanelAnchor");
    arch.add(panelAnchor);
    root.add(arch);

    const result = resolveShellAnchors(root);

    expect(result.anchors.MainStatusPanelAnchor).toBe(panelAnchor);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/anchorResolver.test.ts
```

Expected: FAIL because `anchorContract.ts` and `anchorResolver.ts` do not exist.

- [ ] **Step 3: Create the anchor contract**

Create `apps/web/src/holodeck/shell/anchorContract.ts`:

```ts
import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export const REQUIRED_SHELL_ANCHORS = [
  "WorldRoot",
  "GeneratedWorldRoot",
  "MainStatusPanelAnchor",
  "RecordControlAnchor",
  "UserStartPose"
] as const;

export type ShellAnchorName = (typeof REQUIRED_SHELL_ANCHORS)[number];

export type ShellAnchorMap = Partial<Record<ShellAnchorName, Object3D>>;

export interface ShellAnchorResolution {
  anchors: ShellAnchorMap;
  missing: ShellAnchorName[];
}
```

- [ ] **Step 4: Implement the resolver**

Create `apps/web/src/holodeck/shell/anchorResolver.ts`:

```ts
import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import {
  REQUIRED_SHELL_ANCHORS,
  type ShellAnchorMap,
  type ShellAnchorName,
  type ShellAnchorResolution
} from "./anchorContract.js";

export function resolveShellAnchors(root: Object3D): ShellAnchorResolution {
  const anchors: ShellAnchorMap = {};
  const required = new Set<ShellAnchorName>(REQUIRED_SHELL_ANCHORS);

  root.traverse((object) => {
    if (required.has(object.name as ShellAnchorName)) {
      anchors[object.name as ShellAnchorName] = object;
    }
  });

  return {
    anchors,
    missing: REQUIRED_SHELL_ANCHORS.filter((anchorName) => !anchors[anchorName])
  };
}
```

- [ ] **Step 5: Run anchor resolver tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/anchorResolver.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit anchor resolver**

Run:

```bash
git add apps/web/src/holodeck/shell/anchorContract.ts apps/web/src/holodeck/shell/anchorResolver.ts apps/web/src/holodeck/shell/anchorResolver.test.ts
git commit -m "feat: resolve holodeck shell anchors"
```

## Task 3: Add Static Intent Helper

**Files:**
- Create: `apps/web/src/holodeck/shell/staticIntent.ts`
- Test: `apps/web/src/holodeck/shell/staticIntent.test.ts`

- [ ] **Step 1: Write failing static intent tests**

Create `apps/web/src/holodeck/shell/staticIntent.test.ts`:

```ts
import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import { freezeTransformStaticObjects } from "./staticIntent.js";

describe("freezeTransformStaticObjects", () => {
  it("freezes matrix updates recursively for a static shell tree", () => {
    const root = new Object3D();
    const child = new Object3D();
    const grandchild = new Object3D();
    child.add(grandchild);
    root.add(child);

    freezeTransformStaticObjects(root);

    expect(root.matrixAutoUpdate).toBe(false);
    expect(child.matrixAutoUpdate).toBe(false);
    expect(grandchild.matrixAutoUpdate).toBe(false);
  });

  it("updates matrices before disabling automatic updates", () => {
    const root = new Object3D();
    root.position.set(1, 2, 3);

    freezeTransformStaticObjects(root);

    expect(root.matrix.elements[12]).toBe(1);
    expect(root.matrix.elements[13]).toBe(2);
    expect(root.matrix.elements[14]).toBe(3);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/staticIntent.test.ts
```

Expected: FAIL because `staticIntent.ts` does not exist.

- [ ] **Step 3: Implement static intent helper**

Create `apps/web/src/holodeck/shell/staticIntent.ts`:

```ts
import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";

export function freezeTransformStaticObjects(root: Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
}
```

- [ ] **Step 4: Run static intent tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/staticIntent.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit static intent helper**

Run:

```bash
git add apps/web/src/holodeck/shell/staticIntent.ts apps/web/src/holodeck/shell/staticIntent.test.ts
git commit -m "feat: freeze static shell transforms"
```

## Task 4: Add Placement Layer

**Files:**
- Create: `apps/web/src/holodeck/shell/placement.ts`
- Test: `apps/web/src/holodeck/shell/placement.test.ts`

- [ ] **Step 1: Write failing placement tests**

Create `apps/web/src/holodeck/shell/placement.test.ts`:

```ts
import { Object3D, Vector3 } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it } from "vitest";
import {
  createDebugShellPlacement,
  createShellPlacement
} from "./placement.js";

function namedObject(name: string, position: Vector3) {
  const object = new Object3D();
  object.name = name;
  object.position.copy(position);
  return object;
}

describe("createShellPlacement", () => {
  it("uses exported anchors when they are present", () => {
    const panelAnchor = namedObject(
      "MainStatusPanelAnchor",
      new Vector3(2, 3, 4)
    );
    const generatedWorldRoot = namedObject(
      "GeneratedWorldRoot",
      new Vector3(5, 6, 7)
    );

    const placement = createShellPlacement({
      MainStatusPanelAnchor: panelAnchor,
      GeneratedWorldRoot: generatedWorldRoot
    });

    expect(placement.statusPanel.object).toBe(panelAnchor);
    expect(placement.generatedWorld.object).toBe(generatedWorldRoot);
    expect(placement.statusPanel.position.toArray()).toEqual([2, 3, 4]);
    expect(placement.generatedWorld.position.toArray()).toEqual([5, 6, 7]);
  });

  it("uses debug fallbacks when anchors are unavailable", () => {
    const placement = createShellPlacement({});

    expect(placement.statusPanel.object).toBeNull();
    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.29, -1.9]);
    expect(placement.generatedWorld.object).toBeNull();
    expect(placement.generatedWorld.position.toArray()).toEqual([0, 1.2, 0]);
  });

  it("creates the current debug placements without a shell", () => {
    const placement = createDebugShellPlacement();

    expect(placement.statusPanel.position.toArray()).toEqual([0, 1.29, -1.9]);
    expect(placement.recordControl.position.toArray()).toEqual([0.55, 1.08, -1.85]);
    expect(placement.userStart.position.toArray()).toEqual([-4, 1.5, -6]);
  });
});
```

- [ ] **Step 2: Run failing placement tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/placement.test.ts
```

Expected: FAIL because `placement.ts` does not exist.

- [ ] **Step 3: Implement placement layer**

Create `apps/web/src/holodeck/shell/placement.ts`:

```ts
import {
  Object3D,
  Quaternion,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";
import type { ShellAnchorMap, ShellAnchorName } from "./anchorContract.js";

export interface PlacementTarget {
  object: Object3D | null;
  position: Vector3;
  quaternion: Quaternion;
}

export interface ShellPlacement {
  statusPanel: PlacementTarget;
  recordControl: PlacementTarget;
  generatedWorld: PlacementTarget;
  userStart: PlacementTarget;
}

const DEBUG_POSITIONS = {
  MainStatusPanelAnchor: new Vector3(0, 1.29, -1.9),
  RecordControlAnchor: new Vector3(0.55, 1.08, -1.85),
  GeneratedWorldRoot: new Vector3(0, 1.2, 0),
  UserStartPose: new Vector3(-4, 1.5, -6)
} satisfies Record<Exclude<ShellAnchorName, "WorldRoot">, Vector3>;

export function createDebugShellPlacement(): ShellPlacement {
  return createShellPlacement({});
}

export function createShellPlacement(anchors: ShellAnchorMap): ShellPlacement {
  return {
    statusPanel: targetFromAnchor(
      anchors.MainStatusPanelAnchor ?? null,
      DEBUG_POSITIONS.MainStatusPanelAnchor
    ),
    recordControl: targetFromAnchor(
      anchors.RecordControlAnchor ?? null,
      DEBUG_POSITIONS.RecordControlAnchor
    ),
    generatedWorld: targetFromAnchor(
      anchors.GeneratedWorldRoot ?? null,
      DEBUG_POSITIONS.GeneratedWorldRoot
    ),
    userStart: targetFromAnchor(
      anchors.UserStartPose ?? null,
      DEBUG_POSITIONS.UserStartPose
    )
  };
}

function targetFromAnchor(
  anchor: Object3D | null,
  fallbackPosition: Vector3
): PlacementTarget {
  if (!anchor) {
    return {
      object: null,
      position: fallbackPosition.clone(),
      quaternion: new Quaternion()
    };
  }

  return {
    object: anchor,
    position: anchor.position.clone(),
    quaternion: anchor.quaternion.clone()
  };
}
```

- [ ] **Step 4: Run placement tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/placement.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit placement layer**

Run:

```bash
git add apps/web/src/holodeck/shell/placement.ts apps/web/src/holodeck/shell/placement.test.ts
git commit -m "feat: add holodeck shell placement fallbacks"
```

## Task 5: Add Shell Loader

**Files:**
- Create: `apps/web/src/holodeck/shell/shellLoader.ts`
- Test: `apps/web/src/holodeck/shell/shellLoader.test.ts`

- [ ] **Step 1: Write failing shell loader tests**

Create `apps/web/src/holodeck/shell/shellLoader.test.ts`:

```ts
import { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import { describe, expect, it, vi } from "vitest";
import { loadHolodeckShell } from "./shellLoader.js";

function shellWithRequiredAnchors() {
  const root = new Object3D();
  root.name = "HolodeckShell";
  for (const name of [
    "WorldRoot",
    "GeneratedWorldRoot",
    "MainStatusPanelAnchor",
    "RecordControlAnchor",
    "UserStartPose"
  ]) {
    const anchor = new Object3D();
    anchor.name = name;
    root.add(anchor);
  }
  return root;
}

describe("loadHolodeckShell", () => {
  it("adds a loaded shell to the scene and resolves anchors", () => {
    const shell = shellWithRequiredAnchors();
    const createTransformEntity = vi.fn();

    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => shell,
      createTransformEntity
    });

    expect(result.status).toBe("loaded");
    expect(result.missingAnchors).toEqual([]);
    expect(result.root).toBe(shell);
    expect(result.placement.statusPanel.object?.name).toBe("MainStatusPanelAnchor");
    expect(createTransformEntity).toHaveBeenCalledWith(shell);
    expect(shell.matrixAutoUpdate).toBe(false);
  });

  it("falls back when the shell asset is unavailable", () => {
    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => null,
      createTransformEntity: vi.fn()
    });

    expect(result.status).toBe("missing-asset");
    expect(result.root).toBeNull();
    expect(result.placement.statusPanel.object).toBeNull();
    expect(result.message).toBe("Holodeck shell asset holodeckShell was not loaded.");
  });

  it("loads the shell and reports missing anchors", () => {
    const shell = new Object3D();
    shell.name = "HolodeckShell";
    const worldRoot = new Object3D();
    worldRoot.name = "WorldRoot";
    shell.add(worldRoot);

    const result = loadHolodeckShell({
      assetId: "holodeckShell",
      getGltfScene: () => shell,
      createTransformEntity: vi.fn()
    });

    expect(result.status).toBe("missing-anchors");
    expect(result.missingAnchors).toEqual([
      "GeneratedWorldRoot",
      "MainStatusPanelAnchor",
      "RecordControlAnchor",
      "UserStartPose"
    ]);
    expect(result.message).toContain("Missing holodeck shell anchors");
  });
});
```

- [ ] **Step 2: Run failing shell loader tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/shellLoader.test.ts
```

Expected: FAIL because `shellLoader.ts` does not exist.

- [ ] **Step 3: Implement shell loader**

Create `apps/web/src/holodeck/shell/shellLoader.ts`:

```ts
import type { Object3D } from "@iwsdk/core/dist/runtime/three.js";
import type { ShellAnchorName } from "./anchorContract.js";
import { resolveShellAnchors } from "./anchorResolver.js";
import {
  createDebugShellPlacement,
  createShellPlacement,
  type ShellPlacement
} from "./placement.js";
import { freezeTransformStaticObjects } from "./staticIntent.js";

export type ShellLoadStatus = "loaded" | "missing-asset" | "missing-anchors";

export interface ShellLoadOptions {
  assetId: string;
  getGltfScene(assetId: string): Object3D | null;
  createTransformEntity(object: Object3D): unknown;
}

export interface ShellLoadResult {
  status: ShellLoadStatus;
  root: Object3D | null;
  placement: ShellPlacement;
  missingAnchors: ShellAnchorName[];
  message: string;
}

export function loadHolodeckShell(options: ShellLoadOptions): ShellLoadResult {
  const root = options.getGltfScene(options.assetId);
  if (!root) {
    return {
      status: "missing-asset",
      root: null,
      placement: createDebugShellPlacement(),
      missingAnchors: [],
      message: `Holodeck shell asset ${options.assetId} was not loaded.`
    };
  }

  root.name = root.name || "HolodeckShell";
  options.createTransformEntity(root);

  const resolution = resolveShellAnchors(root);
  const placement = createShellPlacement(resolution.anchors);
  freezeTransformStaticObjects(root);

  if (resolution.missing.length > 0) {
    return {
      status: "missing-anchors",
      root,
      placement,
      missingAnchors: resolution.missing,
      message: `Missing holodeck shell anchors: ${resolution.missing.join(", ")}`
    };
  }

  return {
    status: "loaded",
    root,
    placement,
    missingAnchors: [],
    message: "Holodeck shell loaded."
  };
}
```

- [ ] **Step 4: Run shell loader tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/shell/shellLoader.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit shell loader**

Run:

```bash
git add apps/web/src/holodeck/shell/shellLoader.ts apps/web/src/holodeck/shell/shellLoader.test.ts
git commit -m "feat: load holodeck shell asset"
```

## Task 6: Export And Commit Focused Shell Asset

**Files:**
- Modify: `docs/export/holodeck-shell-focused-export.md`
- Add: `apps/web/public/assets/unity-export/holodeck-shell/holodeck-shell.glb` or `apps/web/public/assets/unity-export/holodeck-shell/holodeck-shell.gltf`
- Add: companion `.bin` and texture files if using `.gltf`

- [ ] **Step 1: Run the export checklist**

Use `docs/export/holodeck-shell-focused-export.md` and complete the validation notes. The required asset path is:

```text
apps/web/public/assets/unity-export/holodeck-shell/holodeck-shell.glb
```

or:

```text
apps/web/public/assets/unity-export/holodeck-shell/holodeck-shell.gltf
```

Expected: the export exists in the web repo and contains the required anchors or clearly documented missing anchors.

- [ ] **Step 2: Check asset size**

Run:

```bash
ls -lh apps/web/public/assets/unity-export/holodeck-shell
```

Expected: exported files are present. If any individual file is near or above 100 MB, use Git LFS before committing:

```bash
git lfs track "*.glb"
git lfs track "*.bin"
git add .gitattributes
```

- [ ] **Step 3: Commit exported asset and completed checklist**

Run:

```bash
git add docs/export/holodeck-shell-focused-export.md apps/web/public/assets/unity-export/holodeck-shell
git commit -m "feat: add focused holodeck shell export"
```

Expected: commit succeeds. If Git rejects the asset due to size, configure Git LFS and retry.

## Task 7: Integrate Shell Loader Into IWSDK Entry Point

**Files:**
- Modify: `apps/web/src/index.ts`

- [ ] **Step 1: Add shell asset to manifest**

In `apps/web/src/index.ts`, add this asset entry inside `const assets: AssetManifest = { ... }` after `robot`:

```ts
  holodeckShell: {
    url: "./assets/unity-export/holodeck-shell/holodeck-shell.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
```

If Task 6 produced `holodeck-shell.glb`, use:

```ts
  holodeckShell: {
    url: "./assets/unity-export/holodeck-shell/holodeck-shell.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
```

- [ ] **Step 2: Import shell loader**

In `apps/web/src/index.ts`, add:

```ts
import { loadHolodeckShell } from "./holodeck/shell/shellLoader";
```

- [ ] **Step 3: Load shell before placing UI**

After `const { camera } = world;`, add:

```ts
  const shellResult = loadHolodeckShell({
    assetId: "holodeckShell",
    scene,
    getGltfScene: (assetId) => AssetManager.getGLTF(assetId)?.scene ?? null,
    createTransformEntity: (object) => world.createTransformEntity(object)
  });
  state.setStatusMessage(shellResult.message);
```

- [ ] **Step 4: Use placement for the status panel**

Replace:

```ts
  panelEntity.object3D!.position.set(0, 1.29, -1.9);
```

with:

```ts
  panelEntity.object3D!.position.copy(shellResult.placement.statusPanel.position);
  panelEntity.object3D!.quaternion.copy(shellResult.placement.statusPanel.quaternion);
```

- [ ] **Step 5: Use placement for generated renderers**

Change renderer construction from:

```ts
  const panoramaRenderer = new PanoramaRenderer(scene);
  const splatRenderer = new SplatRenderer(scene, world.renderer, {
    onStatus: (message) => state.setStatusMessage(message)
  });
```

to:

```ts
  const generatedWorldRoot = shellResult.placement.generatedWorld.object ?? scene;
  const panoramaRenderer = new PanoramaRenderer(generatedWorldRoot);
  const splatRenderer = new SplatRenderer(generatedWorldRoot, world.renderer, {
    onStatus: (message) => state.setStatusMessage(message)
  });
```

If TypeScript reports that `Object3D` is not assignable to the renderer constructor's `Scene` parameter, update `PanoramaRenderer` and `SplatRenderer` constructor parameter types from `Scene` to `Object3D`, and adjust their tests. Both classes only require `.add()` and `.remove()`, which `Object3D` provides.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck --workspace apps/web
```

Expected: PASS.

- [ ] **Step 7: Run tests**

Run:

```bash
npm run test --workspace apps/web
```

Expected: PASS.

- [ ] **Step 8: Run build**

Run:

```bash
npm run build --workspace apps/web
```

Expected: PASS.

- [ ] **Step 9: Commit integration**

Run:

```bash
git add apps/web/src/index.ts apps/web/src/holodeck/rendering/panoramaRenderer.ts apps/web/src/holodeck/rendering/splatRenderer.ts apps/web/src/holodeck/rendering/*.test.ts
git commit -m "feat: attach scene content to holodeck shell anchors"
```

Only include renderer files if Step 5 required widening constructor types.

## Task 8: Manual Browser Verification

**Files:**
- Modify: `docs/export/holodeck-shell-focused-export.md`

- [ ] **Step 1: Start local servers**

Run the server if it is not already running:

```bash
npm run dev:server
```

Run the web app if it is not already running:

```bash
npm run dev:web
```

Expected: server listens on `http://localhost:4817`, web app listens on `https://localhost:8081`.

- [ ] **Step 2: Open the app**

Open:

```text
https://localhost:8081/
```

Expected:

- the shell is visible or an actionable shell warning is shown,
- status panel remains usable,
- no blank scene,
- no uncaught runtime exception.

- [ ] **Step 3: Test local splat path**

Open:

```text
https://localhost:8081/?localSplat=f382fe75-1925-413f-8b42-fff44f13c57b/full_res.spz
```

Expected:

- shell stays loaded,
- status panel shows local splat loading/ready,
- splat appears under `GeneratedWorldRoot` or fallback generated-world position.

- [ ] **Step 4: Update validation notes**

Append the browser verification result to `docs/export/holodeck-shell-focused-export.md` under `Validation Notes`.

- [ ] **Step 5: Commit verification notes**

Run:

```bash
git add docs/export/holodeck-shell-focused-export.md
git commit -m "docs: record holodeck shell verification"
```

## Task 9: Final Verification And Push

**Files:**
- No code changes unless verification reveals a defect.

- [ ] **Step 1: Check working tree**

Run:

```bash
git status --short
```

Expected: clean working tree.

- [ ] **Step 2: Run full checks**

Run:

```bash
npm run test --workspace apps/web
npm run build --workspace apps/web
```

Expected: both commands pass.

- [ ] **Step 3: Push branch**

Run:

```bash
git push
```

Expected: `codex/milestone-2-shell-export` updates on `origin`.

```bash
git push -u origin codex/milestone-2-shell-export
```
