import type { WorldLabsWorldPage, WorldLabsWorldSummary } from "./worldResult.js";

export type WorldLabsBrowserMode = "closed" | "browse" | "confirm-delete";

export interface WorldLabsBrowserState {
  mode: WorldLabsBrowserMode;
  worlds: readonly WorldLabsWorldSummary[];
  selectedWorldId: string | null;
  selectedWorld: WorldLabsWorldSummary | null;
  pendingDeleteWorldId: string | null;
  nextPageToken: string | null;
  pageToken: string | null;
  pageSize: number;
  isLoading: boolean;
  errorMessage: string;
  hiddenDeletedWorldIds: readonly string[];
  canLoadSelectedWorld: boolean;
}

interface WorldLabsBrowserStateOptions {
  pageSize?: number;
}

interface LoadWorldLabsPageOptions {
  append?: boolean;
}

export function createWorldLabsBrowserState(
  options: WorldLabsBrowserStateOptions = {}
): WorldLabsBrowserState {
  return buildWorldLabsBrowserState({
    mode: "closed",
    worlds: [],
    selectedWorldId: null,
    pendingDeleteWorldId: null,
    nextPageToken: null,
    pageToken: null,
    pageSize: options.pageSize ?? 24,
    isLoading: false,
    errorMessage: "",
    hiddenDeletedWorldIds: []
  });
}

export function openWorldLabsBrowser(
  state: WorldLabsBrowserState
): WorldLabsBrowserState {
  return buildWorldLabsBrowserState({
    ...state,
    mode: "browse",
    isLoading: false,
    errorMessage: state.errorMessage
  });
}

export function loadWorldLabsPage(
  state: WorldLabsBrowserState,
  page: WorldLabsWorldPage,
  options: LoadWorldLabsPageOptions = {}
): WorldLabsBrowserState {
  const hiddenDeletedWorldIds = state.hiddenDeletedWorldIds;
  const visibleWorlds = filterHiddenWorlds(page.worlds, hiddenDeletedWorldIds);
  const nextWorlds = options.append
    ? mergeWorldsById(
        filterHiddenWorlds(state.worlds, hiddenDeletedWorldIds),
        visibleWorlds
      )
    : visibleWorlds;

  return buildWorldLabsBrowserState({
    ...state,
    worlds: nextWorlds,
    pageSize: page.pageSize,
    pageToken: page.pageToken ?? null,
    nextPageToken:
      page.nextPageToken !== undefined ? page.nextPageToken : null,
    isLoading: false,
    errorMessage: "",
    hiddenDeletedWorldIds
  });
}

export function selectWorldLabsWorld(
  state: WorldLabsBrowserState,
  worldId: string
): WorldLabsBrowserState {
  return buildWorldLabsBrowserState({
    ...state,
    selectedWorldId: worldId
  });
}

export function confirmWorldDelete(
  state: WorldLabsBrowserState,
  worldId?: string
): WorldLabsBrowserState {
  const targetWorldId = worldId ?? state.selectedWorldId;
  if (!targetWorldId) {
    return state;
  }

  return buildWorldLabsBrowserState({
    ...state,
    mode: "confirm-delete",
    pendingDeleteWorldId: targetWorldId,
    isLoading: false
  });
}

export function markWorldDeleted(
  state: WorldLabsBrowserState,
  worldId: string
): WorldLabsBrowserState {
  const hiddenDeletedWorldIds = uniqueIds([
    ...state.hiddenDeletedWorldIds,
    worldId
  ]);

  return buildWorldLabsBrowserState({
    ...state,
    mode: "browse",
    worlds: state.worlds.filter((world) => world.worldId !== worldId),
    selectedWorldId:
      state.selectedWorldId === worldId ? null : state.selectedWorldId,
    pendingDeleteWorldId:
      state.pendingDeleteWorldId === worldId ? null : state.pendingDeleteWorldId,
    isLoading: false,
    errorMessage: "",
    hiddenDeletedWorldIds
  });
}

export function failWorldLabsBrowser(
  state: WorldLabsBrowserState,
  message: string
): WorldLabsBrowserState {
  return buildWorldLabsBrowserState({
    ...state,
    isLoading: false,
    errorMessage: message
  });
}

function buildWorldLabsBrowserState(
  state: WorldLabsBrowserState
): WorldLabsBrowserState {
  const worlds = filterHiddenWorlds(state.worlds, state.hiddenDeletedWorldIds);
  const selectedWorld =
    worlds.find((world) => world.worldId === state.selectedWorldId) ?? null;

  return {
    ...state,
    worlds,
    selectedWorld,
    canLoadSelectedWorld:
      state.mode === "browse" &&
      selectedWorld !== null &&
      (selectedWorld.hasPanorama || selectedWorld.hasSplat)
  };
}

function filterHiddenWorlds(
  worlds: readonly WorldLabsWorldSummary[],
  hiddenDeletedWorldIds: readonly string[]
): WorldLabsWorldSummary[] {
  if (hiddenDeletedWorldIds.length === 0) {
    return [...worlds];
  }

  const hiddenIds = new Set(hiddenDeletedWorldIds);
  return worlds.filter((world) => !hiddenIds.has(world.worldId));
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function mergeWorldsById(
  existingWorlds: readonly WorldLabsWorldSummary[],
  incomingWorlds: readonly WorldLabsWorldSummary[]
): WorldLabsWorldSummary[] {
  const merged = [...existingWorlds];
  const indicesByWorldId = new Map(
    merged.map((world, index) => [world.worldId, index])
  );

  for (const incomingWorld of incomingWorlds) {
    const existingIndex = indicesByWorldId.get(incomingWorld.worldId);

    if (existingIndex === undefined) {
      indicesByWorldId.set(incomingWorld.worldId, merged.length);
      merged.push(incomingWorld);
      continue;
    }

    merged[existingIndex] = incomingWorld;
  }

  return merged;
}
