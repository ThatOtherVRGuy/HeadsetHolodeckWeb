# Panel UI Parity Design

## Goal

Bring the WebXR arch panels closer to the Unity holodeck UI while keeping this milestone focused on the voice-to-world workflow. The web app should keep the three anchored panels introduced in the shell milestone:

- `OpsPanelAnchor`: command controls on the left arch side.
- `InfoPanelAnchor`: world/session details on the right arch side.
- `StatusPanelAnchor`: crossbeam status readout.

This milestone should improve the panel content, state binding, and LCARS layout. It should not attempt to port every Unity arch subsystem yet.

## Scope

The parity target is the Unity arch UI behavior that matters for current WebXR use:

- record / generate workflow,
- local SPZ loading,
- reset / return to idle,
- current mode and status message,
- run timer and world timer,
- transcript and world/source details when available,
- visible error and warning state,
- reserved model display area.

Deferred Unity features:

- My Worlds browser,
- saved world config management,
- content loader history,
- image search,
- object catalog,
- camera capture,
- editable model selection.

The model selector is deferred because the current web/server path hardcodes World Labs generation to `marble-1.1`. The panel may display `Model: Marble 1.1`, but model switching should be a later server/API milestone.

## Architecture

Add a small testable panel view-model layer under `apps/web/src/holodeck/ui/`. `PanelSystem` should stay responsible for IWSDK entity/document wiring and event listeners, while the view model owns the text, button labels, mode labels, status levels, and timer formatting.

Proposed module:

- `panelViewModel.ts`: converts app state plus lightweight session metadata into `OpsPanelView`, `InfoPanelView`, and `StatusPanelView`.

`PanelSystem` should:

- subscribe to `HolodeckStateMachine`,
- maintain local UI session facts that the current app already knows, such as recording state, selected model label, latest transcript, renderer label, and local splat file/url,
- apply view-model output to UIKit elements by id,
- dispatch button clicks to the existing recorder/coordinator/renderer controls.

This keeps UIKitML markup declarative and keeps logic testable outside IWSDK.

## Panel Content

### Ops Panel

The ops panel becomes a compact LCARS command surface:

- primary command button: `Record` while idle, `Generate` while recording, `Busy` while generation is in progress,
- secondary commands: `Load SPZ` and `Reset`,
- mode strip: current state such as `IDLE`, `REC`, `GEN`, `READY`, or `ERROR`,
- model display: `Model: Marble 1.1`,
- short prompt/status line when useful.

The existing click behavior remains:

- first primary click starts recording,
- second primary click stops recording and generates,
- reset cancels recording, hides the renderer, and returns to idle,
- load SPZ opens the browser file picker.

### Info Panel

The info panel becomes the world/session readout:

- world title/source: local SPZ, World Labs result, or static shell,
- transcript/prompt,
- renderer type: splat, panorama fallback, or none,
- world id or local asset name when available,
- detail/error line.

If no world is loaded, it should clearly say `NO WORLD LOADED` and show the static shell/source state.

### Status Panel

The status panel mirrors the Unity crossbeam status role:

- mode label,
- main message,
- clock/run/world timing line,
- visual status level through LCARS color choices.

The first version does not need animated ticker scrolling. If text is long, it should wrap or truncate safely within the panel bounds.

## Data Flow

The existing voice-to-world flow remains unchanged:

1. User clicks the ops primary command.
2. Browser voice recorder captures audio.
3. `VoiceToWorldCoordinator` drives transcription, World Labs generation, and renderer loading.
4. `HolodeckStateMachine` publishes state and status updates.
5. `PanelSystem` derives the latest panel views and updates UIKit elements.

The view model should accept plain data rather than direct IWSDK objects so it can be unit tested.

## Error Handling

Errors should appear in all relevant layers:

- status panel mode becomes `ERROR`,
- status panel message shows the error,
- info panel detail line shows `ERROR: ...`,
- ops primary command returns to `Record` unless recording is still active.

Warnings and informational messages can share the same flow with different status levels. The current state machine only stores `errorMessage` and `statusMessage`, so this milestone may infer level from state and leave a richer status bus for a later pass.

## Testing

Use test-first changes for behavior:

- view-model tests for each state: idle, recording, generating, ready, error,
- tests for timer formatting,
- tests for transcript/world/local splat metadata mapping,
- existing `PanelSystem` tests are not required unless practical, because IWSDK document behavior is harder to isolate; keep that system thin and rely on view-model tests.

Run:

- `npm run test --workspace apps/web`,
- `npm run build --workspace apps/web`,
- `git diff --check`.

## Acceptance Criteria

- Three panels remain attached to their shell anchors.
- Ops panel exposes Record/Generate, Load SPZ, Reset, mode, and model display.
- Info panel shows meaningful no-world, local splat, generating, ready, and error details.
- Status panel shows mode, message, app run time, and world time.
- The implementation keeps API/model switching deferred and does not change World Labs request parameters.
- Unit tests cover the new view-model logic.
