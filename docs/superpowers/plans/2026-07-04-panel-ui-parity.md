# Panel UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder arch panels with LCARS-style, stateful ops/info/status panels for the current WebXR voice-to-world workflow.

**Architecture:** Keep IWSDK `PanelSystem` as a thin document/event binding layer. Add a pure TypeScript `panelViewModel` module that maps holodeck state, recording/generation flags, world metadata, and timers into panel text/status objects that are easy to unit test. Update UIKitML markup to expose stable ids for those view fields, then bind those fields from `PanelSystem`.

**Tech Stack:** TypeScript, Vitest, Meta IWSDK `PanelUI`/UIKitML, Vite UIKitML compiler.

---

## File Structure

- Create `apps/web/src/holodeck/ui/panelViewModel.ts`: pure panel view derivation, timer formatting, state-to-mode/status mapping.
- Create `apps/web/src/holodeck/ui/panelViewModel.test.ts`: TDD coverage for idle, recording, generating, ready, error, local splat, and timer behavior.
- Modify `apps/web/src/panel.ts`: track lightweight panel session data, call the view model, update additional UIKit ids, keep click handlers unchanged.
- Modify `apps/web/src/holodeck/ui/opsPanel.uikitml`: add mode, model, prompt/status, and LCARS command layout ids.
- Modify `apps/web/src/holodeck/ui/infoPanel.uikitml`: add world title/source/transcript/renderer/detail ids.
- Modify `apps/web/src/holodeck/ui/statusPanel.uikitml`: add mode, message, and health/timer ids.

## Task 1: Add Panel View Model Tests

**Files:**
- Create: `apps/web/src/holodeck/ui/panelViewModel.test.ts`
- Create later: `apps/web/src/holodeck/ui/panelViewModel.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/src/holodeck/ui/panelViewModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPanelViewModel, formatPanelDuration } from "./panelViewModel";

describe("formatPanelDuration", () => {
  it("formats elapsed seconds as h:mm:ss", () => {
    expect(formatPanelDuration(0)).toBe("0:00:00");
    expect(formatPanelDuration(5_000)).toBe("0:00:05");
    expect(formatPanelDuration(65_000)).toBe("0:01:05");
    expect(formatPanelDuration(3_665_000)).toBe("1:01:05");
  });
});

describe("buildPanelViewModel", () => {
  it("shows idle no-world panel state", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Idle",
        errorMessage: "",
        statusMessage: ""
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 12_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Record");
    expect(view.ops.mode).toBe("IDLE");
    expect(view.ops.modelLabel).toBe("Model: Marble 1.1");
    expect(view.info.title).toBe("NO WORLD LOADED");
    expect(view.info.source).toBe("SOURCE STATIC SHELL");
    expect(view.status.mode).toBe("READY");
    expect(view.status.message).toBe("Holodeck systems standing by.");
    expect(view.status.health).toMatch(/RUN 0:00:12  WORLD --:--:--$/);
  });

  it("shows recording state as generate-ready", () => {
    const view = buildPanelViewModel({
      state: {
        current: "ListeningForCommand",
        errorMessage: "",
        statusMessage: "Listening for world prompt."
      },
      isRecording: true,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 22_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Generate");
    expect(view.ops.mode).toBe("REC");
    expect(view.ops.detail).toBe("Listening for world prompt.");
    expect(view.status.mode).toBe("REC");
    expect(view.status.level).toBe("info");
  });

  it("shows generation progress and transcript", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Generating",
        errorMessage: "",
        statusMessage: "Constructing scene. Poll 3, 15s"
      },
      isRecording: false,
      isGenerating: true,
      selectedModelLabel: "Marble 1.1",
      transcript: "a large autumn park",
      rendererLabel: "Splat",
      appElapsedMs: 42_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Busy");
    expect(view.ops.mode).toBe("GEN");
    expect(view.info.title).toBe("GENERATING WORLD");
    expect(view.info.transcript).toBe("PROMPT a large autumn park");
    expect(view.info.renderer).toBe("RENDERER Splat");
    expect(view.status.mode).toBe("GEN");
    expect(view.status.message).toBe("Constructing scene. Poll 3, 15s");
  });

  it("shows local splat ready details", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Ready",
        errorMessage: "",
        statusMessage: "Local splat ready: park/full_res.spz"
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "Splat",
      loadedWorld: {
        title: "park/full_res.spz",
        source: "LOCAL SPZ",
        assetLabel: "park/full_res.spz"
      },
      appElapsedMs: 90_000,
      worldElapsedMs: 8_000
    });

    expect(view.info.title).toBe("park/full_res.spz");
    expect(view.info.source).toBe("SOURCE LOCAL SPZ");
    expect(view.info.asset).toBe("ASSET park/full_res.spz");
    expect(view.status.mode).toBe("READY");
    expect(view.status.level).toBe("success");
    expect(view.status.health).toMatch(/RUN 0:01:30  WORLD 0:00:08$/);
  });

  it("surfaces errors across all panels", () => {
    const view = buildPanelViewModel({
      state: {
        current: "Error",
        errorMessage: "World generation failed",
        statusMessage: ""
      },
      isRecording: false,
      isGenerating: false,
      selectedModelLabel: "Marble 1.1",
      rendererLabel: "None",
      appElapsedMs: 5_000,
      worldElapsedMs: null
    });

    expect(view.ops.primaryActionLabel).toBe("Record");
    expect(view.ops.mode).toBe("ERROR");
    expect(view.info.detail).toBe("ERROR: World generation failed");
    expect(view.status.mode).toBe("ERROR");
    expect(view.status.message).toBe("World generation failed");
    expect(view.status.level).toBe("error");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/ui/panelViewModel.test.ts
```

Expected: FAIL because `./panelViewModel` does not exist.

## Task 2: Implement Panel View Model

**Files:**
- Create: `apps/web/src/holodeck/ui/panelViewModel.ts`
- Test: `apps/web/src/holodeck/ui/panelViewModel.test.ts`

- [ ] **Step 1: Add the minimal implementation**

Create `apps/web/src/holodeck/ui/panelViewModel.ts`:

```ts
import type { HolodeckStateSnapshot } from "../state/holodeckState";

export type PanelStatusLevel = "info" | "success" | "warning" | "error";

export interface LoadedWorldPanelInfo {
  title: string;
  source: string;
  assetLabel?: string;
  worldId?: string;
}

export interface PanelViewModelInput {
  state: HolodeckStateSnapshot;
  isRecording: boolean;
  isGenerating: boolean;
  selectedModelLabel: string;
  rendererLabel: string;
  transcript?: string;
  loadedWorld?: LoadedWorldPanelInfo | null;
  appElapsedMs: number;
  worldElapsedMs: number | null;
}

export interface OpsPanelView {
  mode: string;
  primaryActionLabel: string;
  modelLabel: string;
  detail: string;
}

export interface InfoPanelView {
  title: string;
  source: string;
  transcript: string;
  renderer: string;
  asset: string;
  detail: string;
}

export interface StatusPanelView {
  mode: string;
  message: string;
  health: string;
  level: PanelStatusLevel;
}

export interface PanelViewModel {
  ops: OpsPanelView;
  info: InfoPanelView;
  status: StatusPanelView;
}

export function buildPanelViewModel(input: PanelViewModelInput): PanelViewModel {
  const message = input.state.errorMessage || input.state.statusMessage || defaultMessageFor(input);
  const mode = modeFor(input);
  const loadedWorld = input.loadedWorld ?? null;

  return {
    ops: {
      mode,
      primaryActionLabel: primaryActionLabelFor(input),
      modelLabel: `Model: ${input.selectedModelLabel}`,
      detail: message
    },
    info: {
      title: infoTitleFor(input, loadedWorld),
      source: `SOURCE ${loadedWorld?.source ?? "STATIC SHELL"}`,
      transcript: input.transcript ? `PROMPT ${input.transcript}` : "PROMPT --",
      renderer: `RENDERER ${input.rendererLabel}`,
      asset: assetLineFor(loadedWorld),
      detail: input.state.errorMessage ? `ERROR: ${input.state.errorMessage}` : message
    },
    status: {
      mode: statusModeFor(input, mode),
      message,
      health: healthLineFor(input.appElapsedMs, input.worldElapsedMs),
      level: levelFor(input)
    }
  };
}

export function formatPanelDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function primaryActionLabelFor(input: PanelViewModelInput): string {
  if (input.isGenerating || input.state.current === "Generating") {
    return "Busy";
  }

  return input.isRecording ? "Generate" : "Record";
}

function modeFor(input: PanelViewModelInput): string {
  if (input.state.errorMessage || input.state.current === "Error") {
    return "ERROR";
  }

  if (input.isRecording || input.state.current === "ListeningForCommand") {
    return "REC";
  }

  if (input.isGenerating || input.state.current === "Generating") {
    return "GEN";
  }

  if (input.state.current === "Ready") {
    return "READY";
  }

  return "IDLE";
}

function statusModeFor(input: PanelViewModelInput, mode: string): string {
  if (mode === "IDLE") {
    return "READY";
  }

  return mode;
}

function levelFor(input: PanelViewModelInput): PanelStatusLevel {
  if (input.state.errorMessage || input.state.current === "Error") {
    return "error";
  }

  if (input.state.current === "Ready") {
    return "success";
  }

  return "info";
}

function defaultMessageFor(input: PanelViewModelInput): string {
  switch (input.state.current) {
    case "ListeningForCommand":
      return "Listening for world prompt.";
    case "Interpreting":
      return "Interpreting voice command.";
    case "Generating":
      return "Generating world.";
    case "Ready":
      return "World ready.";
    case "Error":
      return "Holodeck error.";
    default:
      return "Holodeck systems standing by.";
  }
}

function infoTitleFor(
  input: PanelViewModelInput,
  loadedWorld: LoadedWorldPanelInfo | null
): string {
  if (input.state.current === "Generating") {
    return "GENERATING WORLD";
  }

  return loadedWorld?.title ?? "NO WORLD LOADED";
}

function assetLineFor(loadedWorld: LoadedWorldPanelInfo | null): string {
  if (!loadedWorld) {
    return "ASSET --";
  }

  if (loadedWorld.assetLabel) {
    return `ASSET ${loadedWorld.assetLabel}`;
  }

  if (loadedWorld.worldId) {
    return `WORLD ID ${loadedWorld.worldId}`;
  }

  return "ASSET --";
}

function healthLineFor(appElapsedMs: number, worldElapsedMs: number | null): string {
  const now = new Date();
  const realtime = [
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0")
  ].join(":");
  const worldTime =
    worldElapsedMs === null ? "--:--:--" : formatPanelDuration(worldElapsedMs);

  return `${realtime}  RUN ${formatPanelDuration(appElapsedMs)}  WORLD ${worldTime}`;
}
```

- [ ] **Step 2: Run the view-model test**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/ui/panelViewModel.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit view-model tests and implementation**

Run:

```bash
git add apps/web/src/holodeck/ui/panelViewModel.ts apps/web/src/holodeck/ui/panelViewModel.test.ts
git commit -m "feat: add arch panel view model"
```

## Task 3: Expand UIKitML Panel Markup

**Files:**
- Modify: `apps/web/src/holodeck/ui/opsPanel.uikitml`
- Modify: `apps/web/src/holodeck/ui/infoPanel.uikitml`
- Modify: `apps/web/src/holodeck/ui/statusPanel.uikitml`

- [ ] **Step 1: Replace ops panel markup**

Replace `apps/web/src/holodeck/ui/opsPanel.uikitml` with:

```html
<style>
  .ops-panel {
    align-items: stretch;
    padding: 0.9;
    width: 30;
    display: flex;
    flex-direction: column;
    gap: 0.45;
    background-color: #050608;
    border-color: #ff9c2a;
    border-width: 0.18;
    border-radius: 0.8;
  }

  .ops-header {
    display: flex;
    flex-direction: row;
    gap: 0.45;
    align-items: center;
  }

  .mode-pill {
    padding: 0.35;
    width: 8;
    background-color: #ff9c2a;
    color: #050608;
    font-size: 1.25;
    font-weight: bold;
    text-align: center;
    border-radius: 0.45;
  }

  .model-label {
    color: #f6efe5;
    font-size: 1.05;
    text-align: left;
  }

  .ops-button {
    padding: 0.7;
    border-radius: 0.7;
    border-width: 0.1;
    font-size: 1.45;
    font-weight: medium;
    text-align: center;
    cursor: pointer;
  }

  .secondary-row {
    display: flex;
    flex-direction: row;
    gap: 0.45;
  }

  .secondary-button {
    width: 14;
    padding: 0.55;
    border-radius: 0.65;
    border-width: 0.1;
    font-size: 1.05;
    font-weight: medium;
    text-align: center;
    cursor: pointer;
  }

  #recordButton {
    background-color: #ff9c2a;
    border-color: #ff6a2a;
    color: #050608;
  }

  #loadSplatButton {
    background-color: #f6efe5;
    border-color: #ff9c2a;
    color: #050608;
  }

  #resetButton {
    background-color: #58b7ff;
    border-color: #b48cff;
    color: #050608;
  }

  #opsDetailText {
    color: #f6efe5;
    font-size: 0.95;
    text-align: left;
  }
</style>
<div class="ops-panel">
  <div class="ops-header">
    <span id="opsModeText" class="mode-pill">IDLE</span>
    <span id="modelText" class="model-label">Model: Marble 1.1</span>
  </div>
  <button id="recordButton" class="ops-button">Record</button>
  <div class="secondary-row">
    <button id="loadSplatButton" class="secondary-button">Load SPZ</button>
    <button id="resetButton" class="secondary-button">Reset</button>
  </div>
  <span id="opsDetailText">Holodeck systems standing by.</span>
</div>
```

- [ ] **Step 2: Replace info panel markup**

Replace `apps/web/src/holodeck/ui/infoPanel.uikitml` with:

```html
<style>
  .info-panel {
    align-items: stretch;
    padding: 0.9;
    width: 34;
    display: flex;
    flex-direction: column;
    gap: 0.35;
    background-color: #050608;
    border-color: #b48cff;
    border-width: 0.18;
    border-radius: 0.8;
  }

  .info-title {
    font-size: 1.45;
    color: #ff9c2a;
    font-weight: bold;
    text-align: left;
  }

  .info-line {
    font-size: 0.95;
    color: #f6efe5;
    text-align: left;
  }

  .info-detail {
    font-size: 0.95;
    color: #58b7ff;
    text-align: left;
  }
</style>
<div class="info-panel">
  <span id="worldTitleText" class="info-title">NO WORLD LOADED</span>
  <span id="worldSourceText" class="info-line">SOURCE STATIC SHELL</span>
  <span id="transcriptText" class="info-line">PROMPT --</span>
  <span id="rendererText" class="info-line">RENDERER None</span>
  <span id="assetText" class="info-line">ASSET --</span>
  <span id="infoDetailText" class="info-detail">Holodeck systems standing by.</span>
</div>
```

- [ ] **Step 3: Replace status panel markup**

Replace `apps/web/src/holodeck/ui/statusPanel.uikitml` with:

```html
<style>
  .status-panel {
    align-items: stretch;
    padding: 0.55;
    width: 42;
    display: flex;
    flex-direction: column;
    gap: 0.25;
    background-color: #050608;
    border-color: #58b7ff;
    border-width: 0.18;
    border-radius: 0.7;
  }

  .status-row {
    display: flex;
    flex-direction: row;
    gap: 0.45;
    align-items: center;
  }

  .mode-pill {
    padding: 0.25;
    width: 7;
    background-color: #ffcb1f;
    color: #050608;
    font-size: 1;
    font-weight: bold;
    text-align: center;
    border-radius: 0.4;
  }

  #statusText {
    font-size: 1.05;
    color: #f6efe5;
    text-align: left;
  }

  #healthText {
    font-size: 0.75;
    color: #58b7ff;
    text-align: center;
  }
</style>
<div class="status-panel">
  <div class="status-row">
    <span id="statusModeText" class="mode-pill">READY</span>
    <span id="statusText">Holodeck systems standing by.</span>
  </div>
  <span id="healthText">--:--:--  RUN 0:00:00  WORLD --:--:--</span>
</div>
```

- [ ] **Step 4: Run build to verify UIKitML compiles**

Run:

```bash
npm run build --workspace apps/web
```

Expected: PASS and UIKitML compilation summary includes `opsPanel.json`, `infoPanel.json`, and `statusPanel.json`.

- [ ] **Step 5: Commit markup changes**

Run:

```bash
git add apps/web/src/holodeck/ui/opsPanel.uikitml apps/web/src/holodeck/ui/infoPanel.uikitml apps/web/src/holodeck/ui/statusPanel.uikitml apps/web/public/ui/holodeck/opsPanel.json apps/web/public/ui/holodeck/infoPanel.json apps/web/public/ui/holodeck/statusPanel.json
git commit -m "feat: expand arch panel markup"
```

## Task 4: Bind Panel Views in PanelSystem

**Files:**
- Modify: `apps/web/src/panel.ts`
- Modify: `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts`
- Test: `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.test.ts`
- Test: `apps/web/src/holodeck/ui/panelViewModel.test.ts`

- [ ] **Step 1: Write the failing coordinator return-value test**

In `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.test.ts`, update the first test from:

```ts
await coordinator.generateFromAudio(new Blob(["fake audio"]));

expect(state.current).toBe("Ready");
expect(rendererCalls).toEqual(["world_123", "show"]);
```

to:

```ts
const result = await coordinator.generateFromAudio(new Blob(["fake audio"]));

expect(result).toBe(world);
expect(state.current).toBe("Ready");
expect(rendererCalls).toEqual(["world_123", "show"]);
```

- [ ] **Step 2: Run the coordinator test to verify it fails**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/coordinator/voiceToWorldCoordinator.test.ts
```

Expected: FAIL because `generateFromAudio` currently resolves `undefined`.

- [ ] **Step 3: Return the loaded world from the coordinator**

In `apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts`, add:

```ts
import type { WorldResult } from "../world/worldResult";
```

Change the method signature from:

```ts
async generateFromAudio(audio: Blob): Promise<void> {
```

to:

```ts
async generateFromAudio(audio: Blob): Promise<WorldResult | null> {
```

Change early returns for in-flight and empty audio from:

```ts
return;
```

to:

```ts
return null;
```

After the ready transition, add:

```ts
return world;
```

In the catch block, after `state.setError(...)`, add:

```ts
return null;
```

- [ ] **Step 4: Run the coordinator test to verify it passes**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/coordinator/voiceToWorldCoordinator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update imports and session helpers**

In `apps/web/src/panel.ts`, add the view-model import near the other holodeck imports:

```ts
import {
  buildPanelViewModel,
  type LoadedWorldPanelInfo,
  type PanelViewModel
} from "./holodeck/ui/panelViewModel";
```

Add these constants and helpers below the panel config constants:

```ts
const SELECTED_MODEL_LABEL = "Marble 1.1";
const APP_STARTED_AT = Date.now();

interface PanelSessionState {
  isGenerating: boolean;
  transcript: string;
  rendererLabel: string;
  loadedWorld: LoadedWorldPanelInfo | null;
  worldReadyAt: number | null;
}

const panelSession: PanelSessionState = {
  isGenerating: false,
  transcript: "",
  rendererLabel: "None",
  loadedWorld: null,
  worldReadyAt: null
};

function currentPanelView(controls: HolodeckPanelControls): PanelViewModel {
  return buildPanelViewModel({
    state: controls.state.snapshot(),
    isRecording: controls.recorder.isRecording,
    isGenerating: panelSession.isGenerating,
    selectedModelLabel: SELECTED_MODEL_LABEL,
    transcript: panelSession.transcript,
    rendererLabel: panelSession.rendererLabel,
    loadedWorld: panelSession.loadedWorld,
    appElapsedMs: Date.now() - APP_STARTED_AT,
    worldElapsedMs:
      panelSession.worldReadyAt === null ? null : Date.now() - panelSession.worldReadyAt
  });
}

function startPanelClock(update: () => void): () => void {
  const interval = window.setInterval(update, 1000);
  update();

  return () => window.clearInterval(interval);
}

function setText(
  document: UIKitDocument,
  id: string,
  text: string
): void {
  const element = document.getElementById(id) as UIKit.Text | null;
  element?.setProperties({ text });
}

function applyOpsView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "opsModeText", view.ops.mode);
  setText(document, "recordButton", view.ops.primaryActionLabel);
  setText(document, "modelText", view.ops.modelLabel);
  setText(document, "opsDetailText", view.ops.detail);
}

function applyInfoView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "worldTitleText", view.info.title);
  setText(document, "worldSourceText", view.info.source);
  setText(document, "transcriptText", view.info.transcript);
  setText(document, "rendererText", view.info.renderer);
  setText(document, "assetText", view.info.asset);
  setText(document, "infoDetailText", view.info.detail);
}

function applyStatusView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "statusModeText", view.status.mode);
  setText(document, "statusText", view.status.message);
  setText(document, "healthText", view.status.health);
}
```

- [ ] **Step 6: Bind status panel through the view model**

Replace the status panel `qualify` body in `PanelSystem.init()` with:

```ts
this.queries.statusPanel.subscribe("qualify", (entity) => {
  panelCleanups.get(entity.index)?.();

  const document = PanelDocument.data.document[
    entity.index
  ] as UIKitDocument;
  const controls = holodeckControls;
  if (!document || !controls) {
    return;
  }

  const update = () => applyStatusView(document, currentPanelView(controls));
  const unsubscribeState = controls.state.subscribe(update);
  const stopClock = startPanelClock(update);

  panelCleanups.set(entity.index, () => {
    unsubscribeState();
    stopClock();
  });
});
```

- [ ] **Step 7: Bind info panel through the view model**

Replace the info panel `qualify` body with:

```ts
this.queries.infoPanel.subscribe("qualify", (entity) => {
  panelCleanups.get(entity.index)?.();

  const document = PanelDocument.data.document[
    entity.index
  ] as UIKitDocument;
  const controls = holodeckControls;
  if (!document || !controls) {
    return;
  }

  const update = () => applyInfoView(document, currentPanelView(controls));
  const unsubscribeState = controls.state.subscribe(update);
  const stopClock = startPanelClock(update);

  panelCleanups.set(entity.index, () => {
    unsubscribeState();
    stopClock();
  });
});
```

- [ ] **Step 8: Update ops panel binding without changing click behavior**

Inside the ops panel `qualify` body, keep the existing button lookup and click handlers. Remove the `setRecordLabel` helper and replace direct label writes with `applyOpsView(document, currentPanelView(controls))`.

Use these state changes in the handlers:

```ts
const update = () => applyOpsView(document, currentPanelView(controls));

const unsubscribeState = controls.state.subscribe(update);
const stopClock = startPanelClock(update);

const onRecordClick = async () => {
  if (panelSession.isGenerating) {
    controls.state.setStatusMessage("Generation in progress.");
    update();
    return;
  }

  try {
    if (!controls.recorder.isRecording) {
      await controls.recorder.start();
      controls.state.forceState("ListeningForCommand");
      controls.state.setStatusMessage("Listening for world prompt.");
      update();
      return;
    }

    controls.state.setStatusMessage("Preparing world generation.");
    const audio = await controls.recorder.stop();
    panelSession.isGenerating = true;
    update();
    const world = await controls.coordinator.generateFromAudio(audio);
    if (!world) {
      return;
    }
    panelSession.transcript = world.transcript;
    panelSession.rendererLabel = world.localSplat ? "Splat" : "Panorama";
    panelSession.loadedWorld = {
      title: world.displayName || world.transcript || "WORLD LABS WORLD",
      source: "WORLD LABS",
      assetLabel: world.localSplat?.publicUrl,
      worldId: world.worldId
    };
    panelSession.worldReadyAt = Date.now();
  } catch (error) {
    controls.state.setError(
      error instanceof Error ? error.message : "Voice recording failed."
    );
  } finally {
    panelSession.isGenerating = false;
    update();
  }
};
```

Use this reset body:

```ts
const onResetClick = async () => {
  if (panelSession.isGenerating) {
    controls.state.setStatusMessage("Generation in progress.");
    update();
    return;
  }

  try {
    await controls.recorder.cancel();
  } catch (error) {
    controls.state.setError(
      error instanceof Error ? error.message : "Voice recording failed."
    );
    update();
    return;
  }

  panelSession.transcript = "";
  panelSession.rendererLabel = "None";
  panelSession.loadedWorld = null;
  panelSession.worldReadyAt = null;
  controls.renderer.hide();
  controls.state.clearErrorAndReturnToIdle();
  update();
};
```

Keep load SPZ click behavior, but call `update()` after setting the status message.

Cleanup should remove listeners and stop the clock:

```ts
panelCleanups.set(entity.index, () => {
  recordButton.removeEventListener("click", onRecordClick);
  loadSplatButton.removeEventListener("click", onLoadSplatClick);
  resetButton.removeEventListener("click", onResetClick);
  unsubscribeState();
  stopClock();
});
```

- [ ] **Step 9: Run typecheck/test**

Run:

```bash
npm run test --workspace apps/web -- src/holodeck/ui/panelViewModel.test.ts
npm run build --workspace apps/web
```

Expected: both PASS.

- [ ] **Step 10: Commit binding changes**

Run:

```bash
git add apps/web/src/panel.ts apps/web/src/holodeck/coordinator/voiceToWorldCoordinator.ts
git commit -m "feat: bind arch panels to view model"
```

## Task 5: Wire Local Splat Session Metadata

**Files:**
- Modify: `apps/web/src/panel.ts`
- Modify: `apps/web/src/index.ts`
- Test: `apps/web/src/holodeck/ui/panelViewModel.test.ts`

- [ ] **Step 1: Export a session metadata updater**

In `apps/web/src/panel.ts`, export:

```ts
export function setLoadedWorldPanelInfo(info: LoadedWorldPanelInfo | null): void {
  panelSession.loadedWorld = info;
  panelSession.rendererLabel = info ? "Splat" : "None";
  panelSession.worldReadyAt = info ? Date.now() : null;
}
```

- [ ] **Step 2: Import the updater in index**

In `apps/web/src/index.ts`, change the panel import to:

```ts
import {
  configureHolodeckPanelControls,
  PanelSystem,
  setLoadedWorldPanelInfo
} from "./panel.js";
```

- [ ] **Step 3: Set metadata for URL-based local splats**

In `window.holodeck.loadLocalSplat`, after `worldRenderer.show();`, add:

```ts
setLoadedWorldPanelInfo({
  title: url,
  source: "LOCAL SPZ",
  assetLabel: url
});
```

- [ ] **Step 4: Set metadata for browser file local splats**

In `window.holodeck.loadLocalSplatFile`, after `worldRenderer.show();`, add:

```ts
setLoadedWorldPanelInfo({
  title: file.name,
  source: "LOCAL SPZ",
  assetLabel: file.name
});
```

- [ ] **Step 5: Clear metadata on load errors**

In both local splat catch blocks, before throwing the error, add:

```ts
setLoadedWorldPanelInfo(null);
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm run test --workspace apps/web
npm run build --workspace apps/web
```

Expected: all tests PASS and build PASS.

- [ ] **Step 7: Commit local splat metadata**

Run:

```bash
git add apps/web/src/panel.ts apps/web/src/index.ts
git commit -m "feat: show local splat metadata in arch panels"
```

## Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test --workspace apps/web
npm run build --workspace apps/web
git diff --check
```

Expected:

- Vitest passes.
- Vite build passes.
- `git diff --check` prints no output.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git status --short
```

Expected: no uncommitted files.

- [ ] **Step 3: Report manual test URL**

If the dev server is not running, start it:

```bash
npm run dev --workspace apps/web
```

Manual browser check:

- open `https://localhost:8081/`,
- verify the three arch panels are visible,
- verify ops panel shows `Record`, `Load SPZ`, `Reset`, and `Model: Marble 1.1`,
- click `Record` and verify it changes to `Generate`,
- click `Reset` and verify it returns to idle,
- load a local SPZ and verify info/status panels show the local splat.

- [ ] **Step 4: Push branch when user approves**

Run:

```bash
git push -u origin codex/panel-ui-parity
```

Expected: branch pushed successfully.
