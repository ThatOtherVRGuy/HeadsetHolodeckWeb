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
  const message =
    input.state.errorMessage || input.state.statusMessage || defaultMessageFor(input);
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
