import type { HolodeckStateSnapshot } from "../state/holodeckState";
import type {
  WorldLabsBrowserState,
  WorldLabsBrowserMode
} from "../world/worldLabsBrowserState";
import type { WorldLabsWorldSummary } from "../world/worldResult";

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
  browser?: WorldLabsBrowserState;
  appElapsedMs: number;
  worldElapsedMs: number | null;
}

export interface OpsPanelView {
  mode: string;
  primaryActionLabel: string;
  modelLabel: string;
  detail: string;
  browserCards: BrowserWorldCardView[];
  selectedWorldLabel: string;
  pageLabel: string;
  deleteConfirmTitle: string;
  deleteConfirmDetail: string;
  deleteConfirmVisible: boolean;
  browseActionLabel: string;
  refreshActionLabel: string;
  previousActionLabel: string;
  nextActionLabel: string;
  loadActionLabel: string;
  deleteActionLabel: string;
  confirmActionLabel: string;
  cancelActionLabel: string;
}

export interface InfoPanelView {
  title: string;
  source: string;
  transcript: string;
  renderer: string;
  asset: string;
  detail: string;
  browserCards: BrowserWorldCardView[];
  deleteConfirmText: string;
}

export interface StatusPanelView {
  mode: string;
  message: string;
  health: string;
  level: PanelStatusLevel;
  browser: string;
}

export interface BrowserWorldCardView {
  worldId: string;
  title: string;
  meta: string;
  asset: string;
  prompt: string;
  thumbnailUrl: string;
  isSelected: boolean;
  canLoad: boolean;
}

export interface PanelViewModel {
  ops: OpsPanelView;
  info: InfoPanelView;
  status: StatusPanelView;
}

export function buildPanelViewModel(input: PanelViewModelInput): PanelViewModel {
  if (isBrowserMode(input.browser?.mode)) {
    return buildBrowserPanelView(input, input.browser);
  }

  const message =
    input.state.errorMessage || input.state.statusMessage || defaultMessageFor(input);
  const mode = modeFor(input);
  const loadedWorld = input.loadedWorld ?? null;

  return {
    ops: {
      mode,
      primaryActionLabel: primaryActionLabelFor(input),
      modelLabel: `Model: ${input.selectedModelLabel}`,
      detail: message,
      browserCards: [],
      selectedWorldLabel: "WORLDLABS --",
      pageLabel: "PAGE --",
      deleteConfirmTitle: "",
      deleteConfirmDetail: "",
      deleteConfirmVisible: false,
      ...defaultBrowserActions()
    },
    info: {
      title: infoTitleFor(input, loadedWorld),
      source: `SOURCE ${loadedWorld?.source ?? "STATIC SHELL"}`,
      transcript: input.transcript ? `PROMPT ${input.transcript}` : "PROMPT --",
      renderer: `RENDERER ${input.rendererLabel}`,
      asset: assetLineFor(loadedWorld),
      detail: input.state.errorMessage ? `ERROR: ${input.state.errorMessage}` : message,
      browserCards: [],
      deleteConfirmText: ""
    },
    status: {
      mode: statusModeFor(input, mode),
      message,
      health: healthLineFor(input.appElapsedMs, input.worldElapsedMs),
      level: levelFor(input),
      browser: "BROWSER --"
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

function buildBrowserPanelView(
  input: PanelViewModelInput,
  browser: WorldLabsBrowserState
): PanelViewModel {
  const selected = browser.selectedWorld;
  const message = browserStatusMessage(browser);
  const isConfirming = browser.mode === "confirm-delete";

  return {
    ops: {
      mode: isConfirming ? "ALERT" : "BROWSE",
      primaryActionLabel: "Browse",
      modelLabel: `Model: ${input.selectedModelLabel}`,
      detail: message,
      browserCards: browser.worlds.slice(0, 9).map((world) =>
        buildBrowserCard(world, browser.selectedWorldId)
      ),
      selectedWorldLabel: selected
        ? selected.displayName || selected.worldId
        : "WORLDLABS SERVER",
      pageLabel: `Page ${browser.pageToken ? "token" : "1"}`,
      deleteConfirmTitle: isConfirming ? "Are you sure?" : "",
      deleteConfirmDetail: isConfirming ? "There is no 'undo'" : "",
      deleteConfirmVisible: isConfirming,
      browseActionLabel: "BROWSE",
      refreshActionLabel: isConfirming ? "CONFIRM" : "REFRESH",
      previousActionLabel: "PREV",
      nextActionLabel: "NEXT",
      loadActionLabel: "LOAD",
      deleteActionLabel: "DELETE",
      confirmActionLabel: "CONFIRM",
      cancelActionLabel: isConfirming ? "CANCEL" : "BACK"
    },
    info: {
      title: isConfirming ? "CONFIRM DELETE" : "WORLDLABS BROWSER",
      source: selected
        ? `WORLDLABS ${selected.displayName}`
        : "WORLDLABS SERVER",
      transcript: selected ? `PROMPT ${selected.prompt || "--"}` : "PROMPT --",
      renderer: `RENDERER ${selected ? browserAssetLabel(selected) : "Browser"}`,
      asset: selected
        ? `ASSET ${browserAssetLabel(selected).toUpperCase()}`
        : "ASSET NONE",
      detail: isConfirming
        ? `${selected?.displayName ?? "Selected world"} will be permanently deleted.`
        : browserDetail(browser),
      browserCards: browser.worlds.slice(0, 4).map((world) =>
        buildBrowserCard(world, browser.selectedWorldId)
      ),
      deleteConfirmText: isConfirming
        ? `CONFIRM DELETE ${selected?.displayName ?? browser.pendingDeleteWorldId ?? ""}`
        : ""
    },
    status: {
      mode: isConfirming ? "ALERT" : "BROWSE",
      message,
      health: healthLineFor(input.appElapsedMs, input.worldElapsedMs),
      level: browser.errorMessage ? "error" : isConfirming ? "warning" : "info",
      browser: browserStatusLine(browser)
    }
  };
}

function isBrowserMode(mode: WorldLabsBrowserMode | undefined): boolean {
  return mode === "browse" || mode === "confirm-delete";
}

function defaultBrowserActions() {
  return {
    browseActionLabel: "BROWSE",
    refreshActionLabel: "REFRESH",
    previousActionLabel: "PREV",
    nextActionLabel: "NEXT",
    loadActionLabel: "LOAD",
    deleteActionLabel: "DELETE",
    confirmActionLabel: "CONFIRM",
    cancelActionLabel: "BACK"
  };
}

function buildBrowserCard(
  world: WorldLabsWorldSummary,
  selectedWorldId: string | null
): BrowserWorldCardView {
  const title = cleanPanelText(world.displayName || world.worldId, 72);

  return {
    worldId: world.worldId,
    title,
    meta: [world.model, world.status].filter(Boolean).join(" / ") || "WORLDLABS",
    asset: browserAssetLabel(world).toUpperCase(),
    prompt: cleanPanelText(world.prompt || title || "--", 54),
    thumbnailUrl: world.thumbnailUrl,
    isSelected: world.worldId === selectedWorldId,
    canLoad: world.hasPanorama || world.hasSplat
  };
}

function cleanPanelText(text: string, maxLength: number): string {
  const normalized = text
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function browserAssetLabel(world: WorldLabsWorldSummary): string {
  if (world.hasSplat) {
    return "SPZ";
  }

  if (world.hasPanorama) {
    return "PANO";
  }

  return "PENDING";
}

function browserDetail(browser: WorldLabsBrowserState): string {
  if (browser.errorMessage) {
    return `ERROR: ${browser.errorMessage}`;
  }

  if (browser.isLoading) {
    return "Loading WorldLabs worlds.";
  }

  if (browser.selectedWorld) {
    return browser.selectedWorld.prompt || browser.selectedWorld.displayName;
  }

  if (browser.worlds.length === 0) {
    return "No WorldLabs worlds found.";
  }

  return `${browser.worlds.length.toString()} WorldLabs worlds on this page.`;
}

function browserStatusMessage(browser: WorldLabsBrowserState): string {
  if (browser.errorMessage) {
    return browser.errorMessage;
  }

  if (browser.mode === "confirm-delete") {
    return "Confirm WorldLabs delete.";
  }

  if (browser.isLoading) {
    return "Loading WorldLabs worlds.";
  }

  if (browser.selectedWorld) {
    return `Selected ${browser.selectedWorld.displayName || browser.selectedWorld.worldId}.`;
  }

  if (browser.worlds.length === 0) {
    return "No WorldLabs worlds found.";
  }

  return "WorldLabs worlds loaded.";
}

function browserStatusLine(browser: WorldLabsBrowserState): string {
  const page = browser.pageToken ? `PAGE ${browser.pageToken}` : "PAGE START";
  const next = browser.nextPageToken ? "NEXT READY" : "END";
  const selected = browser.selectedWorldId ? "SELECTED" : "NO SELECT";

  return `${page}  ${next}  ${selected}`;
}
