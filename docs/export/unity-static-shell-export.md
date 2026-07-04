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
