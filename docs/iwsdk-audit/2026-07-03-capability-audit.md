# IWSDK Capability Audit

## Purpose

Capture IWSDK capabilities that affect HeadsetHolodeckWeb architecture before deeper implementation.

The immediate product direction is local-first voice-to-panorama world generation, with the Unity holodeck/static arch and UI ported into this new WebXR system. The first rendering path should be simple and debuggable, while keeping clear boundaries for World Labs splat rendering, WebXR Layers, hand interaction, passthrough, scene understanding, and anchors.

## Current Scaffold Facts

- Project scaffold: `apps/web`, generated with `@iwsdk/create` / `@iwsdk/cli` `0.4.2`, TypeScript, Vite, immersive VR mode, XR enabled, no Meta Spatial Editor project yet.
- Core dependencies: `@iwsdk/core@0.4.2` and `three` aliased to `super-three@0.181.0` in `apps/web/package.json`.
- Dev tooling: `@iwsdk/vite-plugin-dev`, `@iwsdk/vite-plugin-uikitml`, `@iwsdk/reference`, `@meta-quest/hzdb`, `vite-plugin-mkcert`, TypeScript, and Vitest.
- Vite config: `apps/web/vite.config.ts` runs HTTPS via `mkcert`, IWSDK dev emulation for `metaQuest3`, AI tooling mode `agent`, and UIKitML compilation from `ui` to `public/ui`.
- Runtime entrypoint: `apps/web/src/index.ts` creates an `ImmersiveVR` world with `handTracking` and `layers` requested. Current feature flags enable locomotion and grabbing, while physics, scene understanding, and environment raycast are disabled.
- Sample scene: current code loads GLTF assets through an `AssetManifest`, uses `AssetManager`, creates transform entities for GLTF content, marks the desk as a `LocomotionEnvironment`, attaches `Interactable` and `DistanceGrabbable`, and creates an in-world `PanelUI` from `./ui/welcome.json`.
- UIKitML source: `apps/web/ui/welcome.uikitml` is a basic compiled panel with an `Enter XR` button. It should be replaced by the holodeck command/status panel rather than treated as final UI.
- Local guidance: `apps/web/AGENTS.md` says one system per file, no barrel `index.ts` files, import Three.js types from `@iwsdk/core`, use `AssetManager` instead of raw loaders, use ECS queries/subscriptions instead of polling, avoid allocations in update loops, and use `entity.dispose()` for GPU-backed objects.

## Initial References

- https://developers.meta.com/horizon/documentation/web/iwsdk-overview/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-spatial-ui/
- https://developers.meta.com/horizon/documentation/web/iwsdk-ai-assisted-dev-tooling/
- https://developers.meta.com/horizon/documentation/web/webxr-workflow/
- https://developers.meta.com/horizon/documentation/web/webxr-layers/
- https://developers.meta.com/horizon/documentation/web/webxr-hands/
- https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-physics/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-scene-understanding/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-environment-raycast/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-camera-access/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-depth-sensing/
- https://developers.meta.com/horizon/documentation/web/iwsdk-guide-browser-first-systems/

## Findings

### ECS Runtime

IWSDK should own the WebXR runtime structure. The Unity `HolodeckStateMachine`, `VoiceToWorldLabsPluginCoordinator`, voice capture, and renderer bridge should be ported as TypeScript modules first, then connected to IWSDK systems/components where frame lifecycle, entity state, or input state matters.

What can be done now:

- Keep pure app state and orchestration in testable TypeScript modules under `apps/web/src/holodeck`.
- Use IWSDK entities only for scene-backed objects: static shell, panorama renderer, UI panels, interactive controls, and future grabbable/generated props.
- Follow the scaffold convention of one system per file, related components nearby, and no barrel files.

What should wait:

- A broad ECS rewrite of all app logic. The voice-to-world pipeline has async network and media edges that are easier to verify outside the render loop.
- Hot-path custom systems until the first UI and panorama renderer exist.

Architecture implication:

- Keep `VoiceToWorldCoordinator` engine-agnostic. Give it a renderer adapter that can later be implemented by a sphere renderer, a splat renderer, or WebXR Layers without changing transcription/generation flow.

### Spatial UI

IWSDK Spatial UI/UIKitML is the primary UI layer for holodeck panels. The generated Vite config already compiles `apps/web/ui/*.uikitml` to `apps/web/public/ui`, and `apps/web/src/index.ts` already demonstrates loading `PanelUI` from compiled JSON.

What can be done now:

- Replace `apps/web/ui/welcome.uikitml` with a holodeck control panel for record/stop, reset, transcript, state, error text, and generated world metadata.
- Use `PanelUI` plus `PanelDocument`/system event handling for button clicks instead of DOM overlay-only controls.
- Keep a desktop-friendly screen-space panel during early development, because the scaffold already uses `ScreenSpace` with CSS string values.

What needs care:

- UIKitML styles are HTML-like, but not a full browser DOM. Event handling must go through IWSDK panel/document patterns.
- The arch UI should be authored as real in-world UI. A debug browser overlay is useful, but should not become the product UI.
- Panel anchoring should be explicit. The current sample places a `PanelUI` entity at `(0, 1.29, -1.9)` and also adds `ScreenSpace`, which is good for early desktop testing but not enough for final holodeck arch placement.
- The static shell export should include named anchor transforms or lightweight anchor meshes for command/status panels, so runtime code can attach UIKitML panels to stable arch locations instead of relying on hand-entered coordinates.
- Viewer-following panels and fixed arch-mounted panels should be separate modes. A recording/status panel may start screen-space or head-relative during development, but the in-world LCARS/holodeck UI should be parented to exported shell anchors.

Architecture implication:

- UI should subscribe to the state model and dispatch intents such as `startRecording`, `stopAndGenerate`, `reset`, and `cancel`. It should not call World Labs or OpenAI directly.
- Introduce a small panel placement layer that can resolve `debugScreen`, `viewerComfort`, and `shellAnchor` placements. That keeps UIKitML content independent from whether the panel is temporarily screen-space, head-relative, or attached to a Unity-exported arch anchor.

### Spatial Editor And Asset Placement

Meta Spatial Editor is useful for static composition, but the scaffold was intentionally created without a Meta Spatial project because the editor/TOS flow was not available during setup.

What can be done now:

- Import Unity-exported GLB/GLTF assets into `apps/web/public/assets/unity-export/`, matching `docs/export/unity-static-shell-export.md`.
- Instantiate the holodeck shell and arch from TypeScript with explicit transforms while Spatial Editor is unavailable.
- Preserve the option to move static placement into Spatial Editor later.

What cannot be assumed yet:

- That Meta Spatial Editor is installed locally.
- That automated Spatial Editor export/import is ready to use in CI or Codex without a one-time local setup.

Architecture implication:

- Put static shell loading behind a small scene-composition module so moving from code-authored transforms to Spatial Editor output does not affect voice, UI, or renderer modules.

### Asset Pipeline

Unity static content should be exported as GLB/GLTF into `apps/web/public/assets/unity-export/`, then optimized for WebXR. The export checklist lives at `docs/export/unity-static-shell-export.md`.

What can be done now:

- Export the holodeck shell, arch, doors, and UI anchor meshes from Unity.
- Load those assets through `AssetManifest` and `AssetManager`, matching IWSDK scaffold practice.
- Simplify Unity materials into web-friendly PBR or unlit materials as needed.

What needs verification:

- Whether the installed Unity GLTF package supports export in the current project. The observed `com.unity.cloud.gltfast` package is primarily known as a glTF loader/import path and should not be treated as proven export tooling until verified in Unity.
- Whether LCARS-style UI should be exported as mesh/material art, rebuilt as UIKitML, or split between decorative mesh trim and live UIKitML controls.

Architecture implication:

- Treat exported assets as static shell content. Runtime-generated panorama/splat content should be a separate child entity/root so clearing or replacing worlds never destroys the holodeck frame.

### Controller And Hand Input

The scaffold requests `handTracking: true` and IWSDK supports XR input, controller interaction, and hand tracking. Milestone one can use panel buttons and desktop emulation, while preserving the Unity-style wake trigger abstraction.

What can be done now:

- Map panel button events to wake/record/reset flows.
- Keep a keyboard or browser button fallback for local development.
- Define a Web equivalent of Unity's `IWakeTrigger` so controller, hand, panel, and keyboard triggers can share one coordinator.

What should wait:

- Production-quality hand gestures, pinch-to-record, controller shortcuts, and multimodal conflict handling.
- Full parity with Unity Input System action maps.

Architecture implication:

- Port the concept, not the exact Unity Input System implementation. The Web port should expose intent events rather than headset-specific button names.

### Locomotion, Comfort, And Interaction Affordances

IWSDK includes locomotion and comfort systems. The sample enables locomotion and marks the desk as a static locomotion environment. For HeadsetHolodeckWeb, the first room can be mostly seated/standing with minimal locomotion.

What can be done now:

- Use IWSDK locomotion where movement is needed.
- Mark exported floor/shell surfaces as locomotion environment only after their collision/scale is verified.
- Keep the command UI within comfortable viewing distance in front of the user.

What should wait:

- Recreating Unity XR Interaction Toolkit locomotion behavior exactly.
- Any feature that makes the user move through generated panoramas before scale, horizon, and comfort are tuned.

Architecture implication:

- The panorama renderer should be viewer-centered at first. The holodeck shell can frame the experience without requiring locomotion to validate the voice-to-world loop.

### Grab Interactions And Physics Integration

IWSDK has grab interactions and Havok-backed physics, and the scaffold already enables grabbing while leaving physics off.

What can be done now:

- Keep simple `Interactable`/button interactions for UI and maybe decorative shell controls.
- Avoid coupling generated panorama rendering to physics.

What should wait:

- Enabling physics globally.
- Dynamic rigid bodies, physics manipulation, or grabbable generated objects.
- TriMesh physics on exported static shell until collision requirements and performance are understood.

Architecture implication:

- Physics belongs in a later interaction layer. The milestone-one renderer should have no dependency on physics.

### Spatial Audio

IWSDK supports spatial audio, and the scaffold demonstrates `AudioSource` with a chime.

What can be done now:

- Use short audio cues for recording start/stop, generation success, and error feedback if desired.
- Keep visual status as the primary feedback channel for milestone one.

What should wait:

- Generated ambience, spatialized world audio, and dynamic audio tied to World Labs results.

Architecture implication:

- Add audio as a subscriber to state transitions, not as part of the core generation coordinator.

### Scene Understanding, Planes, Meshes, And Anchors

IWSDK documents scene understanding, environment raycast, camera access, depth sensing, and related MR capabilities. These are important later, especially for passthrough/mixed reality placement and persistent anchoring.

What can be done now:

- Keep generated-world placement behind a placement service abstraction.
- Keep the static holodeck shell independent from real-room anchoring.

What should wait:

- Plane/mesh detection.
- Persistent anchors.
- Depth occlusion.
- Camera access.

Architecture implication:

- Do not make scene understanding a prerequisite for the voice-to-panorama loop. The renderer should accept a placement transform now and later receive transforms from scene understanding or anchors.

### Passthrough And Mixed Reality

Quest Browser WebXR can support mixed-reality workflows, but the first HeadsetHolodeckWeb experience should be immersive VR. That matches the scaffold's `SessionMode.ImmersiveVR`.

What can be done now:

- Keep the runtime capable of switching session configuration later.
- Avoid hard-coding assumptions that only work in opaque VR.

What should wait:

- Passthrough mode as a first-class UX.
- Real-world occlusion or room-aware placement.

Quest Browser constraints to track:

- WebXR features must be tested on Quest Browser, not only desktop IWER, because feature availability, permission prompts, hand tracking behavior, layers support, and MR capabilities can differ by browser/device/runtime version.
- Local development needs HTTPS. The scaffold already uses `vite-plugin-mkcert`, which is useful for WebXR development, but device testing may still require certificate/network setup on the headset.
- Session mode and feature requests are not guarantees. `handTracking`, `layers`, passthrough/MR, depth, scene understanding, and camera access must be treated as optional capabilities with graceful fallback paths.
- Browser performance is the hard product constraint. Panorama/splat rendering, UIKitML panels, exported shell geometry, and any future physics/scene understanding must fit headset frame budgets and avoid main-thread stalls.
- Permission and privacy surfaces matter for microphone capture, camera access, scene understanding, and mixed reality. The first milestone should request only microphone and immersive VR capabilities needed for voice-to-panorama.

Architecture implication:

- Design `WorldRenderer` and `StaticShell` so the static shell can be hidden, dimmed, or repositioned if a future MR mode uses passthrough instead of a full virtual holodeck room.
- Add capability detection/fallback decisions near XR session startup rather than scattering browser checks through renderer, UI, and input code.

### WebXR Layers

The scaffold requests `layers: true`, and WebXR Layers may be useful for high-quality panoramic rendering on Quest Browser.

What can be done now:

- Start with a simple Three.js/IWSDK panorama sphere or renderer adapter to validate end-to-end voice-to-world.
- Keep the renderer interface narrow enough to swap in a WebXR Layers-backed renderer.

What should wait:

- Layers-first rendering unless initial Quest testing proves the sphere path is insufficient.
- Assumptions that every browser/device supports the same layers features.

Architecture implication:

- The current `WorldRenderer` interface exposes `load(result)`, `show()`, `hide()`, and `dispose()`. Keep that boundary narrow, and add pose or clear-style methods only when a concrete renderer needs them, rather than leaking sphere/layer/splat internals into the coordinator.

### World Labs And Splat Rendering

The Unity app currently relies on the official World Labs Unity plugin. The Web version needs a local server facade for OpenAI and World Labs requests, then a browser renderer for the returned world assets.

What can be done now:

- Normalize server responses into a web-side `WorldResult`.
- Render the first usable panorama image/video/asset format from World Labs through the renderer adapter.
- Keep generated world roots separate from the exported holodeck shell.

What needs investigation:

- Exact World Labs web response shape and asset URLs available from the API.
- Whether a World Labs or third-party splat renderer can consume the generated assets directly in a browser.
- Whether splat rendering should be integrated as a dedicated IWSDK entity/system or isolated behind a Three.js object managed by an IWSDK transform entity.

Architecture implication:

- The World Labs client and renderer should remain separate. The server knows API/auth/polling. The browser renderer knows asset display. The coordinator only knows state transitions.

### IWER, MCP, And Debugging

IWSDK dev tooling includes browser emulation/runtime inspection concepts. The scaffold was created with Codex AI tooling mode, and `apps/web/vite.config.ts` enables IWSDK dev tooling in `agent` mode. During the first dev run, the IWSDK MCP endpoint was exposed at `/__iwer_mcp`.

What can be done now:

- Use `npm run dev:web` for local development and Quest/browser emulation.
- Use `npm run dev:status --workspace apps/web` to inspect the IWSDK dev runtime when needed.
- Use ordinary Vitest/typecheck verification for pure TypeScript modules.

What is optional:

- IWSDK runtime inspection tools from Codex, if available in the current session.
- Claude-specific setup. This project should stay Codex-first and not depend on Claude Code.

Architecture implication:

- Runtime inspection is a productivity boost, not a dependency. Tests and module boundaries should remain good enough that the app is debuggable without live MCP tools.

## Near-Term Decisions

- Build milestone-one UI in UIKitML, not DOM-only HTML.
- Keep server API, app state, voice capture, and renderer adapters testable outside IWSDK.
- Use a simple panorama sphere first unless World Labs web assets make splat rendering equally direct.
- Port Unity architecture concepts: state machine, wake trigger abstraction, coordinator, voice pipeline, renderer bridge. Do not port Unity-specific APIs directly.
- Export Unity shell assets as GLB/GLTF and load them through IWSDK `AssetManifest`/`AssetManager`.
- Defer physics, scene understanding, passthrough, anchors, and WebXR Layers until the local-first voice-to-panorama loop works.
