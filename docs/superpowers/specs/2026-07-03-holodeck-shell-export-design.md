# Holodeck Shell Export Milestone 2 Design

## Goal

Milestone 2 establishes a repeatable path for bringing a focused Unity-authored holodeck shell into HeadsetHolodeckWeb. The milestone should produce a small exported GLB/GLTF asset, commit it under the web app public assets, and load it in the IWSDK scene through a clear anchor contract.

The export should include only the static geometry needed to frame the experience: the holodeck arch/frame, the immediate floor or shell geometry, and named anchor transforms. It should not attempt full Unity scene parity.

## Scope

In scope:

- Create and maintain a checklist for focused Unity shell export.
- Export a focused shell asset from HeadsetHolodeckDev.
- Place the export under `apps/web/public/assets/unity-export/holodeck-shell/`.
- Load the exported asset through IWSDK `AssetManifest` and `AssetManager`.
- Resolve required anchors by name and expose them to runtime placement code.
- Attach or align runtime content to exported anchors where available.
- Keep the existing debug scene and generated world rendering usable if shell loading fails.

Out of scope:

- Full Unity scene parity.
- Final material polish.
- Physics/collider authoring.
- Meta Spatial Editor conversion.
- Passthrough, real-room anchors, or scene understanding.
- Production hand/controller interaction.
- Automated Unity export before the manual checklist validates the asset contract.

## Export Contract

The exported asset should be named either `holodeck-shell.glb` or `holodeck-shell.gltf`. If a `.gltf` export is used, all companion `.bin` and texture files must live in the same `holodeck-shell` folder or a direct child folder.

Unity static intent should be preserved or recorded for every exported object. Three.js does not have a single Unity-equivalent `Static` checkbox, so the export checklist should classify static shell objects as transform-static, render-static, and, where relevant, lighting-static. Runtime code should use that intent to freeze transforms with `matrixAutoUpdate = false` after placement is verified, avoid unnecessary per-frame work, and mark verified floor/shell surfaces as IWSDK static locomotion environment only when they are intended to participate in locomotion.

Required named transforms:

- `WorldRoot`: top-level shell orientation and scale reference.
- `GeneratedWorldRoot`: parent/placement reference for splats and panoramas.
- `MainStatusPanelAnchor`: placement reference for the primary status panel.
- `RecordControlAnchor`: placement reference for recording controls.
- `UserStartPose`: initial user/camera/player pose reference.

Anchor transforms may be empty GameObjects/marker nodes. They must survive export by name. If the export tool strips empty nodes, the checklist should require tiny hidden marker meshes or another exporter-compatible marker strategy.

## Manual Export Checklist

1. Open the Unity reference project and the holodeck scene.
2. Create or verify the five required anchor objects.
3. Select only the focused shell geometry and anchor objects.
4. Record each selected object's Unity static flags or intended static role.
5. Ensure selected objects use web-friendly materials where possible.
6. Export to GLB/GLTF using the available Unity exporter.
7. Verify the exported file opens in an external GLTF viewer or importer.
8. Verify all required anchor names survived the export.
9. Verify whether static metadata survived as GLTF extras/userData; if it did not, record the intended static role in the checklist.
10. Copy the export to `apps/web/public/assets/unity-export/holodeck-shell/`.
11. Record any material, scale, orientation, static-metadata, or missing-node issues in the checklist.
12. Commit the exported asset only after the runtime loader can load it or can report a clear asset-specific error.

## Runtime Architecture

Milestone 2 adds three boundaries.

### Shell Loader

A focused shell-loading module declares the exported asset in the app asset manifest, retrieves it with `AssetManager`, creates the IWSDK transform entity, and returns the loaded root object.

The loader should not know about OpenAI, World Labs, voice capture, or splat rendering.

After the shell has been placed and verified, the loader or placement layer should freeze transform-static shell objects by disabling automatic matrix updates. This is the Three.js/IWSDK runtime equivalent of preserving Unity's static intent for objects that should not move.

### Anchor Resolver

An anchor resolver walks the loaded `Object3D` tree and returns a typed map of required anchors. It reports missing required names explicitly.

The resolver should be unit-tested using synthetic `Object3D` trees, so anchor behavior is independent from the actual Unity export.

### Placement Layer

A placement layer gives runtime systems access to known placement targets. It should prefer exported anchors and fall back to current hard-coded debug placements when the shell or anchors are unavailable.

Initial placements:

- Status panel uses `MainStatusPanelAnchor` when available.
- Record controls use `RecordControlAnchor` when available.
- Generated splat/panorama content aligns to `GeneratedWorldRoot` when available.
- Player/camera startup can reference `UserStartPose` after scale/orientation is verified.

## Data Flow

1. Unity export checklist produces the focused shell asset.
2. Asset is copied into the web app public asset folder.
3. IWSDK `AssetManifest` includes the shell asset.
4. Runtime shell loader instantiates the GLTF/GLB.
5. Anchor resolver walks the loaded object tree.
6. Placement layer stores resolved anchors and fallbacks.
7. UI and generated-world renderers request placement targets from the placement layer.

## Error Handling

If the shell asset is missing or fails to load, the app should keep running with the existing debug scene and show a warning status.

If required anchors are missing, the app should load the shell but report the missing anchor names. Runtime placement should use fallback positions for missing anchors only.

If the asset appears suspiciously scaled or far from origin, the app should log a warning and use fallback positions until the export is corrected.

Generated splats and panoramas must remain usable even when shell loading or anchor resolution fails.

## Testing And Verification

Automated checks:

- Unit test anchor resolution with all required anchors present.
- Unit test missing-anchor reporting.
- Unit test placement fallback behavior.
- Run `npm run test --workspace apps/web`.
- Run `npm run build --workspace apps/web`.

Manual checks:

- Shell asset loads in browser without blocking the existing UI.
- Shell orientation and scale look sane relative to the user.
- Status panel can attach to `MainStatusPanelAnchor`.
- Generated splat/panorama content still loads and appears inside the intended shell frame.
- Missing asset or missing anchor errors are visible and actionable.

## Success Criteria

Milestone 2 is complete when:

- The focused shell export checklist exists and reflects the actual export path.
- A focused holodeck shell asset is committed under `apps/web/public/assets/unity-export/holodeck-shell/`.
- IWSDK runtime attempts to load the shell through the asset manifest.
- Required anchors are resolved or clear missing-anchor diagnostics are shown.
- Existing voice-to-world and local-splat workflows still work with or without the shell.
- Tests and build pass.
