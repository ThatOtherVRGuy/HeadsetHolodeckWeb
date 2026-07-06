# WorldLabs Browser Controls Design

## Goal

Add a WorldLabs account browser to HeadsetHolodeckWeb that mirrors the Unity WorldLabs browser behavior while staying visually aligned with the LCARS arch panels. The user should be able to browse worlds stored on WorldLabs servers, see thumbnails, load a selected world into the existing renderer, and delete a WorldLabs world only after confirmation.

This milestone is server-backed WorldLabs world management. It does not add local storage, local save-as/fork behavior, downloaded world library management, or a generic web gallery.

## Current Context

The web app already has:

- a local Node server that owns `WORLDLABS_API_KEY`,
- `WorldLabsClient.generateWorldFromText()` for voice-generated worlds,
- server job polling and generated splat download support,
- a normalized `WorldResult` render shape,
- `HolodeckApiClient` methods for voice-to-world jobs,
- arch-mounted UIKitML panels with a testable panel view model,
- `PreferredWorldRenderer` and `SplatRenderer` paths that can render any normalized WorldLabs result.

The Unity project has two related browser concepts:

- `MyWorldsPanel`, which browses local saved `WorldConfig` folders.
- The WorldLabs package `WorldBrowserController`, which browses WorldLabs account worlds, shows thumbnails, loads worlds, and deletes worlds with confirmation.

This milestone follows the server-backed `WorldBrowserController` behavior, not the local saved-world picker.

## Scope

In scope:

- List WorldLabs account worlds with pagination.
- Show thumbnail-backed world cards in the arch UI.
- Select a world and load it through the existing render path.
- Delete a selected WorldLabs world with explicit confirmation.
- Keep stale deleted worlds hidden during the session if WorldLabs list responses lag after delete.
- Display loading, empty, error, selected, loading-world, deleting, and deleted states.
- Keep local SPZ and browser-file SPZ paths visually distinct from WorldLabs worlds.
- Preserve the LCARS arch panel language and layout.

Out of scope:

- Local world storage and local cache browsing.
- Save-as, fork, rename, tags editing, or prompt history.
- A separate floating gallery panel.
- Auth beyond the existing local server API key.
- Full WorldLabs search/filter UI beyond page navigation and refresh.
- New rendering code for picked worlds unless required by a normalization gap.

## Architecture

`WorldLabsClient` becomes the server-side facade for account worlds:

- `generateWorldFromText(prompt, transcript, options)`
- `listWorlds(options)`
- `getWorld(worldId)`
- `deleteWorld(worldId)`

The server exposes local routes under `/api/worldlabs/worlds` so the browser never sees the WorldLabs key:

- `GET /api/worldlabs/worlds?pageSize=&pageToken=`
- `GET /api/worldlabs/worlds/:worldId`
- `DELETE /api/worldlabs/worlds/:worldId`

The client adds matching `HolodeckApiClient` methods. Browser UI state lives in a small controller/view-model layer instead of being embedded directly in IWSDK event wiring. That layer owns:

- current page token and previous-page history,
- current page contents,
- selected world id,
- pending delete world id,
- hidden deleted world ids for the current session,
- loading/error/status messages.

Picked worlds normalize to the same `WorldResult` shape used by generated worlds. Rendering remains the responsibility of the existing renderer adapter chain.

## Data Model

`WorldLabsWorldSummary` is the list-friendly shape:

- `worldId`
- `displayName`
- `model`
- `status`
- `createdAt`
- `updatedAt`
- `thumbnailUrl`
- `prompt`
- `hasPanorama`
- `hasSplat`

`WorldLabsWorldPage` contains:

- `worlds: WorldLabsWorldSummary[]`
- `nextPageToken?: string`
- `pageSize`
- `pageToken?: string`

`WorldResult` remains the renderable shape:

- `worldId`
- `displayName`
- `prompt`
- `transcript`
- `panoUrl`
- `thumbnailUrl`
- `spzUrls`
- optional `localSplat`
- optional raw metadata

The server normalizer should tolerate missing thumbnails, missing splats, and worlds that are not complete yet. The UI can show incomplete worlds but should only enable Load when a world has usable render assets.

## UI Flow

The browser lives inside the existing three-panel arch composition.

Ops panel:

- Add a Browse Worlds mode/button next to Record, Load SPZ, and Reset.
- In browse mode, expose Refresh, Previous, Next, Load, Delete, and Cancel/Back controls.
- Keep generation model/status text visible but secondary.

Info panel:

- Show compact LCARS world cards with thumbnail, display name, model/status, and created/updated date.
- Selecting a card makes it the active detail item.
- Delete confirmation replaces the detail/list area with the selected world name, a permanent-delete warning, Confirm Delete, and Cancel.

Status panel:

- Show account browser state: loading list, empty list, page navigation, selected world, loading selected world, deleting world, delete success, and delete failure.
- Keep existing generation status behavior when not in browse mode.

Load flow:

1. User opens Browse Worlds.
2. Client fetches the first page of WorldLabs worlds through the local server.
3. User selects a thumbnail card.
4. User clicks Load.
5. Client fetches world detail if needed, normalizes it to `WorldResult`, and renders through the existing renderer path.

Delete flow:

1. User selects a world.
2. User clicks Delete.
3. Confirmation appears in LCARS alert styling.
4. Confirm calls the local server delete route.
5. On success, the card is removed immediately and its id is hidden for the current session.
6. Refresh/list may still run afterward, but hidden ids prevent recently deleted worlds from reappearing if WorldLabs responses are briefly stale.

## LCARS Layout Constraints

The WorldLabs picker borrows Unity browser behavior, but it must remain an LCARS subsystem of the arch UI.

- Cards should be compact LCARS rows or tiles, not generic rounded web cards.
- Thumbnails are framed inside LCARS geometry: orange/amber rails, black panel field, cyan/blue status accents.
- Controls use arch command vocabulary: `BROWSE`, `LOAD`, `DELETE`, `CONFIRM`, `CANCEL`, `PREV`, `NEXT`, `REFRESH`.
- Delete confirmation is an LCARS alert state, not a browser modal.
- The ops/info/status panel split remains intact: commands left, browser/details right, summary/status crossbar.
- A separate floating gallery is not part of this milestone. If UIKitML cannot practically render the picker inside the existing panels, stop and revise the design before implementing an alternate layout.

## Error Handling

- List failure shows `WorldLabs list unavailable` in Status and keeps the previous page visible if one exists.
- Empty list shows a quiet `No WorldLabs worlds found` state.
- Load failure does not clear the current rendered world.
- Delete requires confirmation and removes the item locally only after server success.
- Delete failure leaves the selected item visible and reports the error in Status.
- Missing thumbnails render an LCARS placeholder tile.
- Incomplete worlds can be shown, but Load is disabled until render assets are available.

## Testing

Server tests:

- `WorldLabsClient.listWorlds()` sends the expected request body and API key header.
- `WorldLabsClient.getWorld()` normalizes a world by id.
- `WorldLabsClient.deleteWorld()` sends `DELETE` and reports success/failure.
- Local routes map upstream list/get/delete errors into clear HTTP responses.
- List normalization tolerates missing thumbnails and asset gaps.

Web tests:

- `HolodeckApiClient` constructs list/get/delete URLs and normalizes responses.
- Browser view model covers loading, empty, selected, paging, confirm-delete, deleting, deleted, and error states.
- Panel event tests cover Browse, Refresh, Prev, Next, Load, Delete, Confirm, and Cancel where practical.
- Existing renderer tests remain mostly unchanged, with one picked-world load test if normalization exposes a new edge.

## Acceptance Criteria

- The arch UI has a browse mode for WorldLabs account worlds.
- A first page of WorldLabs worlds can be listed through the local server.
- World cards show thumbnails when available and LCARS placeholders otherwise.
- Selecting and loading a WorldLabs world renders it through the existing world renderer.
- Delete requires confirmation and calls the WorldLabs delete endpoint through the local server.
- Deleted worlds disappear immediately from the picker and do not reappear in the same session if the remote list is stale.
- Local SPZ and loose browser-file splats remain separate from WorldLabs worlds in UI labels and state.
- The picker reads as LCARS arch UI, not a generic gallery.
- Unit tests cover server client/routes, browser API client, and browser view-model states.
