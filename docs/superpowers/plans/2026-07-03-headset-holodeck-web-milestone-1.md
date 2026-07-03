# HeadsetHolodeckWeb Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local IWSDK WebXR version of HeadsetHolodeck: exported static shell, spatial UI, local server, voice capture, OpenAI transcription, World Labs generation, and panorama display.

**Architecture:** Use Meta IWSDK as the frontend runtime and keep external API keys in a local Node/TypeScript server. Port Unity C# concepts into focused TypeScript modules: state machine, voice capture, generation coordinator, World Labs client, renderer adapters, and status bus. Keep panorama rendering behind a `WorldRenderer` interface so splat and mesh rendering can be added later.

**Tech Stack:** Meta IWSDK, Vite, TypeScript, UIKitML, Three.js/IWSDK rendering, Node.js, Vitest, local `.env`, Unity MCP-assisted GLB export.

---

## Planned File Structure

The IWSDK scaffold may create additional files. Preserve its generated conventions, but organize project-specific code with these responsibilities:

- `apps/web/src/holodeck/state/holodeckState.ts`: state enum, transition table, state machine.
- `apps/web/src/holodeck/status/statusBus.ts`: user-facing status events for UI panels.
- `apps/web/src/holodeck/world/worldResult.ts`: normalized world result type shared by frontend modules.
- `apps/web/src/holodeck/rendering/worldRenderer.ts`: renderer interface.
- `apps/web/src/holodeck/rendering/panoramaRenderer.ts`: panorama renderer implementation.
- `apps/web/src/holodeck/voice/browserVoiceRecorder.ts`: browser microphone recording.
- `apps/web/src/holodeck/api/holodeckApiClient.ts`: frontend client for local server.
- `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts`: app flow orchestration.
- `apps/web/src/holodeck/ui/statusPanel.uikitml`: first spatial status/control panel.
- `apps/web/src/holodeck/ui/lcarsTheme.ts`: LCARS color/style tokens for UIKitML.
- `apps/server/src/config/env.ts`: local environment validation.
- `apps/server/src/openai/transcriptionClient.ts`: OpenAI transcription wrapper.
- `apps/server/src/worldlabs/worldLabsClient.ts`: World Labs generation/polling wrapper.
- `apps/server/src/routes/voiceToWorld.ts`: local endpoint for audio-to-world.
- `apps/server/src/server.ts`: local server entrypoint.
- `docs/export/unity-static-shell-export.md`: Unity export procedure.
- `docs/iwsdk-audit/2026-07-03-capability-audit.md`: IWSDK capability notes.

## Task 1: Scaffold IWSDK Project

**Files:**
- Create/modify generated IWSDK files in `apps/web/`
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Verify repo is empty and clean**

Run:

```bash
pwd
git status --short
rg --files
```

Expected:

```text
/Users/davidarendash/Documents/Projects/Unity/HeadsetHolodeckWeb
```

`git status --short` and `rg --files` should print no project files except any plan/docs files already created.

- [ ] **Step 2: Scaffold IWSDK app**

Run the current IWSDK scaffold command from Meta docs:

```bash
npm create @iwsdk@latest apps/web
```

If the package name has changed, run:

```bash
npm create iwsdk@latest apps/web
```

Choose TypeScript, Vite, IWSDK core, Spatial UI/UIKitML support, and IWER/dev tooling when prompted. Do not enable Claude-only workflow requirements.

Expected:

```text
apps/web/package.json
apps/web/src
```

- [ ] **Step 3: Add root workspace package**

Create root `package.json`:

```json
{
  "name": "headset-holodeck-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": [
    "apps/web",
    "apps/server"
  ],
  "scripts": {
    "dev": "npm run dev --workspace apps/web",
    "dev:web": "npm run dev --workspace apps/web",
    "dev:server": "npm run dev --workspace apps/server",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

- [ ] **Step 4: Add repository ignore file**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
.DS_Store
coverage/
*.log
apps/web/.vite/
apps/web/dist/
apps/server/dist/
assets/test-worlds/cache/
```

- [ ] **Step 5: Add README**

Create `README.md`:

```markdown
# HeadsetHolodeckWeb

Parallel WebXR port of HeadsetHolodeckDev.

The first milestone is local-first:

- Meta IWSDK frontend
- UIKitML spatial UI
- exported Unity holodeck shell
- local Node server for OpenAI and World Labs secrets
- voice-to-World-Labs panorama generation

Implementation work happens in this repository. HeadsetHolodeckDev remains the Unity reference implementation.
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
npm install
```

Expected: lockfile created and no install errors.

- [ ] **Step 7: Run generated app**

Run:

```bash
npm run dev:web
```

Expected: Vite/IWSDK dev server starts and prints a local URL.

- [ ] **Step 8: Commit scaffold**

Run:

```bash
git add package.json package-lock.json .gitignore README.md apps/web
git commit -m "chore: scaffold IWSDK web app"
```

## Task 2: Add Local Server Skeleton

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/server.ts`
- Create: `apps/server/src/config/env.ts`
- Test: `apps/server/src/config/env.test.ts`

- [ ] **Step 1: Create server package**

Create `apps/server/package.json`:

```json
{
  "name": "@headset-holodeck/server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@fastify/multipart": "^8.3.1",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "undici": "^6.19.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create server TypeScript config**

Create `apps/server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write failing env tests**

Create `apps/server/src/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readServerEnv } from "./env.js";

describe("readServerEnv", () => {
  it("reads required keys from a plain object", () => {
    const env = readServerEnv({
      OPENAI_API_KEY: "sk-test",
      WORLDLABS_API_KEY: "wl-test",
      PORT: "4817"
    });

    expect(env).toEqual({
      openAiApiKey: "sk-test",
      worldLabsApiKey: "wl-test",
      port: 4817
    });
  });

  it("rejects missing API keys", () => {
    expect(() => readServerEnv({})).toThrow(
      "OPENAI_API_KEY and WORLDLABS_API_KEY are required"
    );
  });
});
```

- [ ] **Step 4: Run env tests and verify failure**

Run:

```bash
npm run test --workspace apps/server -- src/config/env.test.ts
```

Expected: FAIL because `env.ts` does not exist.

- [ ] **Step 5: Implement env reader**

Create `apps/server/src/config/env.ts`:

```ts
export interface ServerEnv {
  openAiApiKey: string;
  worldLabsApiKey: string;
  port: number;
}

export function readServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const openAiApiKey = source.OPENAI_API_KEY?.trim() ?? "";
  const worldLabsApiKey = source.WORLDLABS_API_KEY?.trim() ?? "";

  if (!openAiApiKey || !worldLabsApiKey) {
    throw new Error("OPENAI_API_KEY and WORLDLABS_API_KEY are required");
  }

  const parsedPort = Number(source.PORT ?? "4817");

  return {
    openAiApiKey,
    worldLabsApiKey,
    port: Number.isFinite(parsedPort) ? parsedPort : 4817
  };
}
```

- [ ] **Step 6: Add server entrypoint**

Create `apps/server/src/server.ts`:

```ts
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import Fastify from "fastify";
import { readServerEnv } from "./config/env.js";

dotenv.config();

const env = readServerEnv(process.env);
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});
await app.register(multipart);

app.get("/health", async () => ({
  ok: true,
  service: "headset-holodeck-web-server"
}));

await app.listen({
  host: "0.0.0.0",
  port: env.port
});
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm run test --workspace apps/server
npm run typecheck --workspace apps/server
```

Expected: both pass.

- [ ] **Step 8: Commit server skeleton**

Run:

```bash
git add apps/server package.json package-lock.json
git commit -m "chore: add local server skeleton"
```

## Task 3: Port Core Types And State Machine

**Files:**
- Create: `apps/web/src/holodeck/state/holodeckState.ts`
- Create: `apps/web/src/holodeck/world/worldResult.ts`
- Test: `apps/web/src/holodeck/state/holodeckState.test.ts`

- [ ] **Step 1: Add Vitest scripts to web app**

Modify `apps/web/package.json` so it includes these scripts and dev dependency while preserving the IWSDK scaffold's generated scripts and dependencies:

```json
{
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Preserve existing IWSDK scripts and dependencies.

- [ ] **Step 2: Write failing state tests**

Create `apps/web/src/holodeck/state/holodeckState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HolodeckStateMachine } from "./holodeckState";

describe("HolodeckStateMachine", () => {
  it("follows the voice-to-world happy path", () => {
    const machine = new HolodeckStateMachine();

    expect(machine.current).toBe("Idle");
    expect(machine.tryTransitionTo("ListeningForCommand")).toBe(true);
    expect(machine.tryTransitionTo("Interpreting")).toBe(true);
    expect(machine.tryTransitionTo("Generating")).toBe(true);
    expect(machine.tryTransitionTo("Ready")).toBe(true);
    expect(machine.current).toBe("Ready");
  });

  it("rejects invalid transitions without changing state", () => {
    const machine = new HolodeckStateMachine();

    expect(machine.tryTransitionTo("Ready")).toBe(false);
    expect(machine.current).toBe("Idle");
  });

  it("enters error from any state and can recover to idle", () => {
    const machine = new HolodeckStateMachine();

    machine.tryTransitionTo("ListeningForCommand");
    machine.setError("Microphone permission denied");

    expect(machine.current).toBe("Error");
    expect(machine.errorMessage).toBe("Microphone permission denied");

    machine.clearErrorAndReturnToIdle();

    expect(machine.current).toBe("Idle");
    expect(machine.errorMessage).toBe("");
  });
});
```

- [ ] **Step 3: Run state tests and verify failure**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/state/holodeckState.test.ts
```

Expected: FAIL because `holodeckState.ts` does not exist.

- [ ] **Step 4: Implement state machine**

Create `apps/web/src/holodeck/state/holodeckState.ts`:

```ts
export type HolodeckState =
  | "Idle"
  | "ListeningForCommand"
  | "Interpreting"
  | "Generating"
  | "Ready"
  | "Error";

const allowedTransitions: Record<HolodeckState, HolodeckState[]> = {
  Idle: ["ListeningForCommand", "Generating", "Ready", "Error"],
  ListeningForCommand: ["Interpreting", "Idle", "Error"],
  Interpreting: ["Generating", "Idle", "Error"],
  Generating: ["Ready", "Idle", "Error"],
  Ready: ["Idle", "Generating", "Error"],
  Error: ["Idle"]
};

export class HolodeckStateMachine {
  current: HolodeckState = "Idle";
  errorMessage = "";

  tryTransitionTo(next: HolodeckState): boolean {
    if (!allowedTransitions[this.current].includes(next)) {
      return false;
    }

    this.current = next;
    if (next !== "Error") {
      this.errorMessage = "";
    }
    return true;
  }

  forceState(next: HolodeckState): void {
    this.current = next;
    if (next !== "Error") {
      this.errorMessage = "";
    }
  }

  setError(message: string): void {
    this.current = "Error";
    this.errorMessage = message;
  }

  clearErrorAndReturnToIdle(): void {
    this.current = "Idle";
    this.errorMessage = "";
  }
}
```

- [ ] **Step 5: Add WorldResult type**

Create `apps/web/src/holodeck/world/worldResult.ts`:

```ts
export interface WorldResult {
  worldId: string;
  displayName: string;
  prompt: string;
  transcript: string;
  panoUrl: string;
  thumbnailUrl?: string;
  spzUrls: Record<string, string>;
  meshUrl?: string;
  raw: unknown;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/state/holodeckState.test.ts
npm run typecheck --workspace apps/web
```

Expected: pass.

- [ ] **Step 7: Commit core state**

Run:

```bash
git add apps/web/src/holodeck apps/web/package.json apps/web/package-lock.json package-lock.json
git commit -m "feat: add holodeck web state model"
```

## Task 4: Implement Server-Side World Labs Normalization With Mocks

**Files:**
- Create: `apps/server/src/worldlabs/worldTypes.ts`
- Create: `apps/server/src/worldlabs/normalizeWorld.ts`
- Test: `apps/server/src/worldlabs/normalizeWorld.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `apps/server/src/worldlabs/normalizeWorld.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeWorld } from "./normalizeWorld.js";

describe("normalizeWorld", () => {
  it("extracts panorama, splat urls, and mesh url", () => {
    const world = normalizeWorld({
      world_id: "world_123",
      display_name: "Crystal Atrium",
      assets: {
        thumbnail_url: "https://example.test/thumb.jpg",
        imagery: {
          pano_url: "https://example.test/pano.jpg"
        },
        splats: {
          spz_urls: {
            "100k": "https://example.test/100k.spz",
            "500k": "https://example.test/500k.spz"
          }
        },
        mesh: {
          collider_mesh_url: "https://example.test/collider.glb"
        }
      }
    }, {
      prompt: "make a crystal atrium",
      transcript: "make a crystal atrium"
    });

    expect(world).toMatchObject({
      worldId: "world_123",
      displayName: "Crystal Atrium",
      prompt: "make a crystal atrium",
      transcript: "make a crystal atrium",
      panoUrl: "https://example.test/pano.jpg",
      thumbnailUrl: "https://example.test/thumb.jpg",
      spzUrls: {
        "100k": "https://example.test/100k.spz",
        "500k": "https://example.test/500k.spz"
      },
      meshUrl: "https://example.test/collider.glb"
    });
  });

  it("throws when panorama url is absent", () => {
    expect(() =>
      normalizeWorld({ world_id: "world_123", assets: {} }, {
        prompt: "empty",
        transcript: "empty"
      })
    ).toThrow("World Labs result did not include a panorama URL");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm run test --workspace apps/server -- src/worldlabs/normalizeWorld.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 3: Add World Labs types**

Create `apps/server/src/worldlabs/worldTypes.ts`:

```ts
export interface WorldLabsWorld {
  world_id?: string;
  display_name?: string;
  assets?: {
    thumbnail_url?: string;
    imagery?: {
      pano_url?: string;
    };
    splats?: {
      spz_urls?: Record<string, string>;
    };
    mesh?: {
      collider_mesh_url?: string;
    };
  };
}

export interface WorldResult {
  worldId: string;
  displayName: string;
  prompt: string;
  transcript: string;
  panoUrl: string;
  thumbnailUrl?: string;
  spzUrls: Record<string, string>;
  meshUrl?: string;
  raw: unknown;
}
```

- [ ] **Step 4: Implement normalizer**

Create `apps/server/src/worldlabs/normalizeWorld.ts`:

```ts
import type { WorldLabsWorld, WorldResult } from "./worldTypes.js";

interface NormalizeContext {
  prompt: string;
  transcript: string;
}

export function normalizeWorld(
  world: WorldLabsWorld,
  context: NormalizeContext
): WorldResult {
  const panoUrl = world.assets?.imagery?.pano_url?.trim() ?? "";

  if (!panoUrl) {
    throw new Error("World Labs result did not include a panorama URL");
  }

  const worldId = world.world_id?.trim() ?? "";

  return {
    worldId,
    displayName: world.display_name?.trim() || worldId || "Untitled World",
    prompt: context.prompt,
    transcript: context.transcript,
    panoUrl,
    thumbnailUrl: world.assets?.thumbnail_url,
    spzUrls: world.assets?.splats?.spz_urls ?? {},
    meshUrl: world.assets?.mesh?.collider_mesh_url,
    raw: world
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test --workspace apps/server -- src/worldlabs/normalizeWorld.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit normalization**

Run:

```bash
git add apps/server/src/worldlabs
git commit -m "feat: normalize World Labs world results"
```

## Task 5: Add Frontend API Client And Coordinator With Mocked Server

**Files:**
- Create: `apps/web/src/holodeck/api/holodeckApiClient.ts`
- Create: `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts`
- Test: `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.test.ts`

- [ ] **Step 1: Write failing coordinator test**

Create `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HolodeckStateMachine } from "../state/holodeckState";
import { VoiceToWorldCoordinator } from "./voiceToWorldCoordinator";
import type { WorldResult } from "../world/worldResult";

describe("VoiceToWorldCoordinator", () => {
  it("moves through interpreting, generating, and ready", async () => {
    const state = new HolodeckStateMachine();
    const world: WorldResult = {
      worldId: "world_123",
      displayName: "Crystal Atrium",
      prompt: "make a crystal atrium",
      transcript: "make a crystal atrium",
      panoUrl: "https://example.test/pano.jpg",
      spzUrls: {},
      raw: {}
    };

    const rendererCalls: string[] = [];
    const coordinator = new VoiceToWorldCoordinator({
      state,
      api: {
        voiceToWorld: async () => world
      },
      renderer: {
        mode: "panorama",
        load: async received => {
          rendererCalls.push(received.worldId);
        },
        show: () => rendererCalls.push("show"),
        hide: () => rendererCalls.push("hide"),
        dispose: () => rendererCalls.push("dispose")
      }
    });

    await coordinator.generateFromAudio(new Blob(["fake audio"]));

    expect(state.current).toBe("Ready");
    expect(rendererCalls).toEqual(["world_123", "show"]);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/coordinator/voiceToWorldCoordinator.test.ts
```

Expected: FAIL because coordinator does not exist.

- [ ] **Step 3: Add frontend API client**

Create `apps/web/src/holodeck/api/holodeckApiClient.ts`:

```ts
import type { WorldResult } from "../world/worldResult";

export interface HolodeckApi {
  voiceToWorld(audio: Blob): Promise<WorldResult>;
}

export class HolodeckApiClient implements HolodeckApi {
  constructor(private readonly baseUrl = "http://localhost:4817") {}

  async voiceToWorld(audio: Blob): Promise<WorldResult> {
    const form = new FormData();
    form.append("audio", audio, "command.webm");

    const response = await fetch(`${this.baseUrl}/api/voice-to-world`, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voice-to-world failed: HTTP ${response.status} ${body}`);
    }

    return response.json() as Promise<WorldResult>;
  }
}
```

- [ ] **Step 4: Add renderer interface**

Create `apps/web/src/holodeck/rendering/worldRenderer.ts`:

```ts
import type { WorldResult } from "../world/worldResult";

export interface WorldRenderer {
  readonly mode: "static" | "panorama" | "splat" | "mesh";
  load(world: WorldResult): Promise<void>;
  show(): void;
  hide(): void;
  dispose(): void;
}
```

- [ ] **Step 5: Implement coordinator**

Create `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts`:

```ts
import type { HolodeckApi } from "../api/holodeckApiClient";
import type { WorldRenderer } from "../rendering/worldRenderer";
import type { HolodeckStateMachine } from "../state/holodeckState";

interface VoiceToWorldCoordinatorDeps {
  state: HolodeckStateMachine;
  api: HolodeckApi;
  renderer: WorldRenderer;
}

export class VoiceToWorldCoordinator {
  constructor(private readonly deps: VoiceToWorldCoordinatorDeps) {}

  async generateFromAudio(audio: Blob): Promise<void> {
    const { state, api, renderer } = this.deps;

    if (audio.size === 0) {
      state.setError("No audio was captured.");
      return;
    }

    state.forceState("Interpreting");

    try {
      state.forceState("Generating");
      const world = await api.voiceToWorld(audio);
      await renderer.load(world);
      renderer.show();

      if (!state.tryTransitionTo("Ready")) {
        state.forceState("Ready");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice-to-world failed.";
      state.setError(message);
    }
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/coordinator/voiceToWorldCoordinator.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit coordinator**

Run:

```bash
git add apps/web/src/holodeck
git commit -m "feat: add voice to world coordinator"
```

## Task 6: Add Unity Export Documentation And Staging Checklist

**Files:**
- Create: `docs/export/unity-static-shell-export.md`

- [ ] **Step 1: Create export documentation**

Create `docs/export/unity-static-shell-export.md`:

```markdown
# Unity Static Shell Export

Source project:

`/Users/davidarendash/Documents/Projects/Unity/HeadsetHolodeckDev`

Target project:

`/Users/davidarendash/Documents/Projects/Unity/HeadsetHolodeckWeb`

## Export Candidates

- `Assets/Models/TNGHolodeck.prefab`
- `Assets/Scenes/Holodeck.unity`
- `Assets/Models/Materials`
- door geometry and simple door animation data if exportable
- arch/UI anchor transforms for UIKitML panel placement

## Unity MCP Inspection Checklist

1. Inspect open scenes.
2. Locate `Environment/TNGHolodeck`.
3. Locate arch and LCARS-related scene objects.
4. Record transforms for UI panel anchor points.
5. Confirm materials/textures used by the static shell.
6. Create or identify a staging prefab/scene containing static export objects only.
7. Strip scripts and Unity-only components from the export candidate.
8. Export GLB/GLTF.
9. Import into `apps/web/public/assets/unity-export/`.
10. Verify scale, orientation, materials, and anchor positions in IWSDK.

## Notes

The current Unity repo includes `com.unity.cloud.gltfast`, which is used for GLB import. If no GLTF exporter is installed, add a Unity GLTF exporter package or use a Blender bridge only if Unity export fails.
```

- [ ] **Step 2: Commit export docs**

Run:

```bash
git add docs/export/unity-static-shell-export.md
git commit -m "docs: add Unity static shell export checklist"
```

## Task 7: Add IWSDK Capability Audit Document

**Files:**
- Create: `docs/iwsdk-audit/2026-07-03-capability-audit.md`

- [ ] **Step 1: Create capability audit document**

Create `docs/iwsdk-audit/2026-07-03-capability-audit.md`:

```markdown
# IWSDK Capability Audit

## Purpose

Capture IWSDK capabilities that affect HeadsetHolodeckWeb architecture before deeper implementation.

## Areas To Audit

- ECS runtime patterns and system/component conventions
- Spatial UI/UIKitML authoring, styling, events, and anchoring
- Spatial Editor workflow and asset placement
- Asset optimization/import pipeline
- Controller and hand input
- Locomotion, comfort, and interaction affordances
- Grab interactions and physics integration
- Spatial audio
- Scene understanding, planes, meshes, and anchors
- Passthrough/MR capabilities and Quest Browser constraints
- WebXR Layers for panorama rendering
- IWER desktop emulation and debugging
- Optional MCP/runtime inspection tools usable from Codex

## Initial References

- https://developers.meta.com/horizon/documentation/web/iwsdk-overview/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-spatial-ui/
- https://developers.meta.com/horizon/documentation/web/iwsdk-ai-assisted-dev-tooling/
- https://developers.meta.com/horizon/documentation/web/webxr-workflow/
- https://developers.meta.com/horizon/documentation/web/webxr-layers/
- https://developers.meta.com/horizon/documentation/web/webxr-hands/
- https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/

## Findings

### ECS Runtime

IWSDK is the primary app framework and should own scene runtime structure. HeadsetHolodeckWeb systems should be written as IWSDK-friendly systems/components instead of unmanaged global scripts once the scaffold conventions are visible.

### Spatial UI

IWSDK Spatial UI/UIKitML is the primary UI layer for arch panels. The first UI should be in-world, not a DOM-only overlay. UIKitML should hold status, record/reset controls, transcript display, and world metadata.

### Spatial Editor And Asset Placement

Use the Spatial Editor to place exported static shell assets and UI panel anchors. Avoid hand-tuning all transforms in code unless the editor-generated placement path is insufficient.

### Asset Pipeline

Static Unity content should be exported as GLB/GLTF and imported into the IWSDK app. Shader-heavy Unity materials may need web-side material simplification or replacement.

### Input

Milestone one can use panel buttons and desktop emulation. Later milestones should map controller and hand inputs to record, cancel, reset, grab, and placement flows.

### Locomotion And Comfort

Use IWSDK/browser-first locomotion and comfort patterns rather than porting Unity XR Interaction Toolkit behavior directly.

### Physics And Grab

IWSDK includes physics/grab interaction support useful for later object interaction and world manipulation. Do not couple milestone-one panorama rendering to physics.

### Spatial Audio

Spatial audio is a later enhancement for generated-world ambience and UI feedback. Keep milestone-one status feedback visual first.

### Scene Understanding And Anchors

Scene understanding, plane/mesh detection, and anchors are milestone-three capabilities. The first architecture should leave placement and anchor systems independent from the renderer.

### Passthrough And MR

Passthrough/MR should be treated as a later mode, not as a prerequisite for voice-to-panorama.

### WebXR Layers

WebXR Layers may provide higher-quality panorama display on Quest Browser. Start with a simple panorama sphere if it is faster, but keep the renderer boundary ready for a layers-backed implementation.

### IWER And Debugging

Use IWSDK/IWER desktop emulation for frequent local testing. Optional MCP/runtime inspection tools are useful if Codex can access them, but implementation must remain debuggable without Claude Code.
```

- [ ] **Step 2: Extend findings with scaffold-specific notes**

After Task 1 creates the IWSDK scaffold, append concrete notes from generated files to each audit subsection. Include file paths such as `apps/web/package.json`, `apps/web/src/main.ts`, and any generated UIKitML or Spatial Editor files.

- [ ] **Step 3: Commit audit seed**

Run:

```bash
git add docs/iwsdk-audit/2026-07-03-capability-audit.md
git commit -m "docs: add IWSDK capability audit"
```

## Task 8: Wire Real Server Route

**Files:**
- Create: `apps/server/src/openai/transcriptionClient.ts`
- Create: `apps/server/src/worldlabs/worldLabsClient.ts`
- Create: `apps/server/src/routes/voiceToWorld.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Create OpenAI transcription client**

Create `apps/server/src/openai/transcriptionClient.ts`:

```ts
export interface TranscriptionClient {
  transcribe(audio: Uint8Array, fileName: string, contentType: string): Promise<string>;
}

export class OpenAiTranscriptionClient implements TranscriptionClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly model = "gpt-4o-transcribe"
  ) {}

  async transcribe(audio: Uint8Array, fileName: string, contentType: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([audio], { type: contentType }), fileName);
    form.append("model", this.model);
    form.append("response_format", "json");
    form.append("language", "en");
    form.append("temperature", "0");

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json"
      },
      body: form
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI transcription failed: HTTP ${response.status} ${body}`);
    }

    const json = (await response.json()) as { text?: string };
    const text = json.text?.trim() ?? "";

    if (!text) {
      throw new Error("OpenAI transcription returned empty text");
    }

    return text;
  }
}
```

- [ ] **Step 2: Create World Labs client skeleton**

Create `apps/server/src/worldlabs/worldLabsClient.ts`:

```ts
import { normalizeWorld } from "./normalizeWorld.js";
import type { WorldLabsWorld, WorldResult } from "./worldTypes.js";

interface GenerateWorldResponse {
  operation_id?: string;
}

interface OperationResponse {
  done?: boolean;
  error?: { message?: string };
  response?: WorldLabsWorld;
}

export class WorldLabsClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.worldlabs.ai",
    private readonly pollIntervalMs = 5000,
    private readonly timeoutMs = 600000
  ) {}

  async generateWorldFromText(prompt: string, transcript = prompt): Promise<WorldResult> {
    const generation = await this.postJson<GenerateWorldResponse>("/marble/v1/worlds", {
      world_prompt: {
        type: "text",
        text_prompt: prompt
      },
      display_name: buildDisplayName(prompt),
      model: "marble-1.1",
      permission: "private"
    });

    if (!generation.operation_id) {
      throw new Error("World Labs did not return an operation id");
    }

    const operation = await this.waitForOperation(generation.operation_id);

    if (operation.error?.message) {
      throw new Error(operation.error.message);
    }

    if (!operation.response) {
      throw new Error("World Labs operation completed without a world payload");
    }

    return normalizeWorld(operation.response, { prompt, transcript });
  }

  private async waitForOperation(operationId: string): Promise<OperationResponse> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.timeoutMs) {
      const operation = await this.getJson<OperationResponse>(`/marble/v1/operations/${operationId}`);

      if (operation.done) {
        return operation;
      }

      await delay(this.pollIntervalMs);
    }

    throw new Error("Timed out waiting for World Labs generation");
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "WLT-Api-Key": this.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`World Labs request failed: HTTP ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "WLT-Api-Key": this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`World Labs request failed: HTTP ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }
}

function buildDisplayName(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 60) || "Headset Holodeck World";
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 3: Create route**

Create `apps/server/src/routes/voiceToWorld.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { TranscriptionClient } from "../openai/transcriptionClient.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

interface VoiceToWorldDeps {
  transcription: TranscriptionClient;
  worldLabs: WorldLabsClient;
}

export async function registerVoiceToWorldRoute(
  app: FastifyInstance,
  deps: VoiceToWorldDeps
): Promise<void> {
  app.post("/api/voice-to-world", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: "Missing audio file" });
    }

    const bytes = new Uint8Array(await file.toBuffer());

    if (bytes.byteLength === 0) {
      return reply.code(400).send({ error: "Audio file was empty" });
    }

    const transcript = await deps.transcription.transcribe(
      bytes,
      file.filename || "command.webm",
      file.mimetype || "audio/webm"
    );

    const world = await deps.worldLabs.generateWorldFromText(transcript, transcript);
    return reply.send(world);
  });
}
```

- [ ] **Step 4: Register route in server**

Modify `apps/server/src/server.ts`:

```ts
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import Fastify from "fastify";
import { readServerEnv } from "./config/env.js";
import { OpenAiTranscriptionClient } from "./openai/transcriptionClient.js";
import { registerVoiceToWorldRoute } from "./routes/voiceToWorld.js";
import { WorldLabsClient } from "./worldlabs/worldLabsClient.js";

dotenv.config();

const env = readServerEnv(process.env);
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});
await app.register(multipart);

app.get("/health", async () => ({
  ok: true,
  service: "headset-holodeck-web-server"
}));

await registerVoiceToWorldRoute(app, {
  transcription: new OpenAiTranscriptionClient(env.openAiApiKey),
  worldLabs: new WorldLabsClient(env.worldLabsApiKey)
});

await app.listen({
  host: "0.0.0.0",
  port: env.port
});
```

- [ ] **Step 5: Run server typecheck**

Run:

```bash
npm run typecheck --workspace apps/server
```

Expected: pass.

- [ ] **Step 6: Commit route**

Run:

```bash
git add apps/server/src
git commit -m "feat: add voice to world server route"
```

## Task 9: Add Browser Voice Recorder

**Files:**
- Create: `apps/web/src/holodeck/voice/browserVoiceRecorder.ts`

- [ ] **Step 1: Add browser voice recorder**

Create `apps/web/src/holodeck/voice/browserVoiceRecorder.ts`:

```ts
export class BrowserVoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      throw new Error("Voice recording is already active");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);

    this.recorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });

    this.recorder.start();
  }

  async stop(): Promise<Blob> {
    if (!this.recorder || this.recorder.state !== "recording") {
      throw new Error("Voice recording is not active");
    }

    const recorder = this.recorder;

    const stopped = new Promise<void>(resolve => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });

    recorder.stop();
    await stopped;

    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.recorder = null;

    const type = this.chunks[0]?.type || "audio/webm";
    const audio = new Blob(this.chunks, { type });
    this.chunks = [];

    if (audio.size === 0) {
      throw new Error("No microphone samples were captured");
    }

    return audio;
  }
}
```

- [ ] **Step 2: Typecheck frontend**

Run:

```bash
npm run typecheck --workspace apps/web
```

Expected: pass.

- [ ] **Step 3: Commit recorder**

Run:

```bash
git add apps/web/src/holodeck/voice
git commit -m "feat: add browser voice recorder"
```

## Task 10: Add First Panorama Renderer

**Files:**
- Create: `apps/web/src/holodeck/rendering/panoramaRenderer.ts`

- [ ] **Step 1: Add panorama renderer**

Create `apps/web/src/holodeck/rendering/panoramaRenderer.ts`:

```ts
import * as THREE from "three";
import type { WorldResult } from "../world/worldResult";
import type { WorldRenderer } from "./worldRenderer";

export class PanoramaRenderer implements WorldRenderer {
  readonly mode = "panorama" as const;

  private mesh: THREE.Mesh | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  async load(world: WorldResult): Promise<void> {
    this.dispose();

    const texture = await new THREE.TextureLoader().loadAsync(world.panoUrl);
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(50, 64, 32);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
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

  dispose(): void {
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

function disposeMaterial(material: THREE.Material): void {
  const withMap = material as THREE.Material & { map?: THREE.Texture };
  withMap.map?.dispose();
  material.dispose();
}
```

- [ ] **Step 2: Typecheck frontend**

Run:

```bash
npm run typecheck --workspace apps/web
```

Expected: pass.

- [ ] **Step 3: Commit panorama renderer**

Run:

```bash
git add apps/web/src/holodeck/rendering
git commit -m "feat: add panorama world renderer"
```

## Task 11: Integrate UI Controls Into IWSDK App

**Files:**
- Create: `apps/web/src/holodeck/ui/lcarsTheme.ts`
- Create/modify: `apps/web/src/holodeck/ui/statusPanel.uikitml`
- Modify: `apps/web/src/main.ts`

- [ ] **Step 1: Add LCARS theme tokens**

Create `apps/web/src/holodeck/ui/lcarsTheme.ts`:

```ts
export const lcarsTheme = {
  background: "#050608",
  panel: "#111318",
  amber: "#ff9c2a",
  orange: "#ff6a2a",
  blue: "#58b7ff",
  violet: "#b48cff",
  text: "#f6efe5",
  warning: "#ffd166",
  error: "#ff4d5e",
  success: "#59d98e"
} as const;
```

- [ ] **Step 2: Add first UIKitML status panel**

Create `apps/web/src/holodeck/ui/statusPanel.uikitml` using the UIKitML syntax shown by the IWSDK scaffold. It should include this structure:

```html
<container class="lcars-panel">
  <text id="statusText">Holodeck systems standing by.</text>
  <button id="recordButton">Record</button>
  <button id="resetButton">Reset</button>
</container>
```

If the IWSDK scaffold uses different element names, keep the same IDs and visible labels while matching the generated UIKitML syntax.

- [ ] **Step 3: Wire generated app entrypoint**

Open the scaffolded `apps/web/src` entrypoint. Add:

```ts
import { BrowserVoiceRecorder } from "./holodeck/voice/browserVoiceRecorder";
import { HolodeckApiClient } from "./holodeck/api/holodeckApiClient";
import { VoiceToWorldCoordinator } from "./holodeck/coordinator/voiceToWorldCoordinator";
import { HolodeckStateMachine } from "./holodeck/state/holodeckState";
```

Instantiate these next to the IWSDK scene setup:

```ts
const state = new HolodeckStateMachine();
const recorder = new BrowserVoiceRecorder();
const api = new HolodeckApiClient();
```

After creating the Three.js/IWSDK scene object, create:

```ts
const panoramaRenderer = new PanoramaRenderer(scene);
const coordinator = new VoiceToWorldCoordinator({
  state,
  api,
  renderer: panoramaRenderer
});
```

Wire the status panel record button so the first press calls `recorder.start()` and the second press calls `recorder.stop()` then `coordinator.generateFromAudio(audio)`.

- [ ] **Step 4: Run frontend dev server**

Run:

```bash
npm run dev:web
```

Expected: app loads and the panel is visible in desktop emulation.

- [ ] **Step 5: Commit UI integration**

Run:

```bash
git add apps/web/src
git commit -m "feat: wire first holodeck spatial controls"
```

## Task 12: Local End-To-End Smoke Test

**Files:**
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add environment example**

Create `.env.example`:

```dotenv
OPENAI_API_KEY=replace_me
WORLDLABS_API_KEY=replace_me
PORT=4817
```

- [ ] **Step 2: Add local run docs**

Append to `README.md`:

```markdown
## Local Development

Create `.env` in the repo root:

```dotenv
OPENAI_API_KEY=your_openai_key
WORLDLABS_API_KEY=your_worldlabs_key
PORT=4817
```

Install dependencies:

```bash
npm install
```

Run the local server:

```bash
npm run dev:server
```

Run the IWSDK app:

```bash
npm run dev:web
```

Open the Vite URL in a desktop browser for emulation or in Quest Browser using the local network/HTTPS path required by the current IWSDK setup.
```

- [ ] **Step 3: Run server and web app**

Terminal A:

```bash
npm run dev:server
```

Terminal B:

```bash
npm run dev:web
```

Expected: both start without errors.

- [ ] **Step 4: Test health endpoint**

Run:

```bash
curl http://localhost:4817/health
```

Expected:

```json
{"ok":true,"service":"headset-holodeck-web-server"}
```

- [ ] **Step 5: Browser smoke test**

In the app:

1. Enter desktop emulation or WebXR session.
2. Press Record.
3. Speak a short prompt.
4. Press Record again to stop.
5. Confirm status advances through interpreting/generating/loading.
6. Confirm the panorama appears or an actionable error appears.

- [ ] **Step 6: Commit smoke test docs**

Run:

```bash
git add .env.example README.md
git commit -m "docs: add local smoke test workflow"
```

## Self-Review Checklist

- Spec coverage: Tasks cover scaffold, local server, state model, C#-guided boundaries, Unity export docs, IWSDK audit, voice capture, World Labs flow, panorama rendering, local smoke test.
- Deferred scope: Splat renderer, mesh renderer, MR scene understanding, anchors, passthrough, physics, and hand shortcuts are intentionally milestone 2 or 3.
- Placeholder scan: The only intentional replacement step is Task 7 findings, and it tells the worker exactly what to replace during execution.
- Type consistency: `WorldResult`, `WorldRenderer`, `HolodeckStateMachine`, and `VoiceToWorldCoordinator` names are consistent across tasks.
