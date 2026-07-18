import {
  createSystem,
  PanelUI,
  PanelDocument,
  eq,
  UIKitDocument,
  UIKit,
} from "@iwsdk/core";
import type { HolodeckStateMachine } from "./holodeck/state/holodeckState";
import type { BrowserVoiceRecorder } from "./holodeck/voice/browserVoiceRecorder";
import type { VoiceToWorldCoordinator } from "./holodeck/coordinator/voiceToWorldCoordinator";
import type { WorldRenderer } from "./holodeck/rendering/worldRenderer";
import type { HolodeckApi } from "./holodeck/api/holodeckApiClient";
import {
  looksLikeVoiceCommandAttempt,
  looksLikeWorldGenerationPrompt
} from "./holodeck/voiceCommand/intent";
import {
  buildPanelViewModel,
  type LoadedWorldPanelInfo,
  type PanelViewModel
} from "./holodeck/ui/panelViewModel";
import {
  confirmWorldDelete,
  createWorldLabsBrowserState,
  failWorldLabsBrowser,
  loadWorldLabsPage,
  markWorldDeleted,
  openWorldLabsBrowser,
  selectWorldLabsWorld
} from "./holodeck/world/worldLabsBrowserState";
import type { WorldLabsWorldSummary } from "./holodeck/world/worldResult";

interface HolodeckPanelControls {
  state: HolodeckStateMachine;
  recorder: BrowserVoiceRecorder;
  coordinator: VoiceToWorldCoordinator;
  renderer: WorldRenderer;
  openLocalSplatFilePicker: () => void;
  api: HolodeckApi;
  setShellVisible: (visible: boolean) => void;
  executeVoiceCommand?: (transcript: string) => {
    handled: boolean;
    message: string;
  };
}

let holodeckControls: HolodeckPanelControls | null = null;
let opsPanelUpdate: (() => void) | null = null;
let browserState = createWorldLabsBrowserState();
let hasRequestedInitialWorldLabsBrowse = false;
const STATUS_PANEL_CONFIG = "./ui/holodeck/statusPanel.json";
const OPS_PANEL_CONFIG = "./ui/holodeck/opsPanel.json";
const INFO_PANEL_CONFIG = "./ui/holodeck/infoPanel.json";
const SELECTED_MODEL_LABEL = "Marble 1.1";
const APP_STARTED_AT = Date.now();
const EMPTY_THUMBNAIL_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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
    browser: browserState,
    appElapsedMs: Date.now() - APP_STARTED_AT,
    worldElapsedMs:
      panelSession.worldReadyAt === null ? null : Date.now() - panelSession.worldReadyAt
  });
}

export function setLoadedWorldPanelInfo(info: LoadedWorldPanelInfo | null): void {
  panelSession.transcript = "";
  panelSession.loadedWorld = info;
  panelSession.rendererLabel = info ? "Splat" : "None";
  panelSession.worldReadyAt = info ? Date.now() : null;
}

export function setPanelWorldLoadInProgress(isGenerating: boolean): void {
  panelSession.isGenerating = isGenerating;
}

export function resetGeneratedWorldPanelSession(): void {
  panelSession.transcript = "";
  panelSession.rendererLabel = "None";
  panelSession.loadedWorld = null;
  panelSession.worldReadyAt = null;
  updateOpsPanel();
}

export async function startVoicePromptRecording(): Promise<void> {
  const controls = holodeckControls;
  if (!controls) {
    return;
  }

  if (panelSession.isGenerating) {
    controls.state.setStatusMessage("Generation in progress.");
    updateOpsPanel();
    return;
  }

  if (controls.recorder.isRecording) {
    return;
  }

  try {
    console.info("[Holodeck] voice recording start requested");
    await controls.recorder.start();
    controls.state.forceState("ListeningForCommand");
    controls.state.setStatusMessage("Listening for world prompt.");
    console.info("[Holodeck] voice recording started");
  } catch (error) {
    console.warn("[Holodeck] voice recording failed to start", error);
    controls.state.setError(
      error instanceof Error ? error.message : "Voice recording failed."
    );
  } finally {
    updateOpsPanel();
  }
}

export async function stopVoicePromptAndGenerateWorld(): Promise<void> {
  const controls = holodeckControls;
  if (!controls) {
    return;
  }

  if (panelSession.isGenerating) {
    controls.state.setStatusMessage("Generation in progress.");
    updateOpsPanel();
    return;
  }

  if (!controls.recorder.isRecording) {
    return;
  }

  try {
    controls.state.setStatusMessage("Preparing world generation.");
    console.info("[Holodeck] voice recording stop requested");
    const audio = await controls.recorder.stop();
    console.info("[Holodeck] voice recording stopped", {
      byteLength: audio.size,
      type: audio.type
    });
    panelSession.isGenerating = true;
    updateOpsPanel();
    if (controls.api.transcribeAudio && controls.executeVoiceCommand) {
      controls.state.forceState("Interpreting");
      controls.state.setStatusMessage("Interpreting voice command.");
      console.info("[Holodeck] transcribing voice command audio");
      const transcript = await controls.api.transcribeAudio(audio);
      console.info("[Holodeck] voice transcript received", { transcript });
      panelSession.transcript = transcript;
      updateOpsPanel();
      const commandResult = controls.executeVoiceCommand(transcript);
      console.info("[Holodeck] voice command route result", commandResult);

      if (commandResult.handled) {
        controls.state.forceState("Ready");
        controls.state.setStatusMessage(commandResult.message);
        return;
      }

      if (!looksLikeWorldGenerationPrompt(transcript)) {
        controls.state.clearErrorAndReturnToIdle();
        controls.state.setStatusMessage(commandResult.message);
        console.info("[Holodeck] transcript was not generated", {
          transcript,
          commandLike: looksLikeVoiceCommandAttempt(transcript)
        });
        return;
      }

      console.info("[Holodeck] transcript was not a local command; generating world");
      const world = await controls.coordinator.generateFromTranscript(transcript);
      applyGeneratedWorldSession(world);
      return;
    }

    const world = await controls.coordinator.generateFromAudio(audio);
    applyGeneratedWorldSession(world);
  } catch (error) {
    console.warn("[Holodeck] voice prompt handling failed", error);
    controls.state.setError(
      error instanceof Error ? error.message : "Voice recording failed."
    );
  } finally {
    panelSession.isGenerating = false;
    updateOpsPanel();
  }
}

function applyGeneratedWorldSession(
  world: Awaited<ReturnType<VoiceToWorldCoordinator["generateFromAudio"]>>
): void {
  if (world === null) {
    return;
  }

  panelSession.transcript = world.transcript;
  panelSession.rendererLabel = hasSplatSource(world) ? "Splat" : "Panorama";
  panelSession.loadedWorld = {
    title: world.displayName || world.transcript || "WORLD LABS WORLD",
    source: "WORLD LABS",
    assetLabel: world.localSplat?.publicUrl,
    worldId: world.worldId
  };
  panelSession.worldReadyAt = Date.now();
}

export function hasSplatSource(world: {
  localSplat?: unknown;
  spzUrls: Record<string, string>;
}): boolean {
  return (
    Boolean(world.localSplat) ||
    Object.values(world.spzUrls).some((url) => url.trim().length > 0)
  );
}

export function isWorldLabsSummaryLoadable(
  world: Pick<WorldLabsWorldSummary, "hasPanorama" | "hasSplat">
): boolean {
  return world.hasPanorama || world.hasSplat;
}

export function filterHiddenWorldLabsWorlds<T extends { worldId: string }>(
  page: {
    worlds: readonly T[];
    pageSize: number;
    nextPageToken?: string;
    pageToken?: string;
  },
  hiddenWorldIds: readonly string[]
): {
  worlds: T[];
  pageSize: number;
  nextPageToken?: string;
  pageToken?: string;
} {
  const hidden = new Set(hiddenWorldIds);

  return {
    ...page,
    worlds: page.worlds.filter((world) => !hidden.has(world.worldId))
  };
}

function startPanelClock(update: () => void): () => void {
  const interval = window.setInterval(update, 1000);
  update();

  return () => window.clearInterval(interval);
}

function updateOpsPanel(): void {
  opsPanelUpdate?.();
}

function setText(
  document: UIKitDocument,
  id: string,
  text: string
): void {
  const element = document.getElementById(id) as UIKit.Text | null;
  element?.setProperties({ text });
}

function setImageSource(
  document: UIKitDocument,
  id: string,
  src: string
): void {
  const element = document.getElementById(id) as UIKit.Image | null;
  element?.setProperties({ src: src || EMPTY_THUMBNAIL_SRC });
}

function setElementDisplay(
  document: UIKitDocument,
  id: string,
  display: "flex" | "none"
): void {
  const element = document.getElementById(id) as
    | { setProperties: (properties: { display: "flex" | "none" }) => void }
    | null;
  element?.setProperties({ display });
}

function applyOpsView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "opsModeText", view.ops.mode);
  setText(document, "recordButton", view.ops.primaryActionLabel);
  setText(document, "modelText", view.ops.modelLabel);
  setText(document, "opsDetailText", view.ops.detail);
  setText(document, "selectedWorldText", view.ops.selectedWorldLabel);
  setText(document, "pageText", view.ops.pageLabel);
  setText(document, "deleteConfirmTitleText", view.ops.deleteConfirmTitle);
  setText(document, "deleteConfirmDetailText", view.ops.deleteConfirmDetail);
  setText(document, "browseWorldsButton", view.ops.browseActionLabel);
  setText(document, "refreshWorldsButton", view.ops.refreshActionLabel);
  setText(document, "prevWorldsButton", view.ops.previousActionLabel);
  setText(document, "nextWorldsButton", view.ops.nextActionLabel);
  setText(document, "loadWorldButton", view.ops.loadActionLabel);
  setText(document, "deleteWorldButton", view.ops.deleteActionLabel);
  setText(document, "confirmDeleteButton", view.ops.confirmActionLabel);
  setText(document, "cancelBrowserButton", view.ops.cancelActionLabel);
  setElementDisplay(
    document,
    "worldDeleteConfirm",
    view.ops.deleteConfirmVisible ? "flex" : "none"
  );

  for (let index = 0; index < 9; index += 1) {
    const card = view.ops.browserCards[index];
    setElementDisplay(document, `worldCard${index}`, card ? "flex" : "none");
    setElementDisplay(document, `worldDelete${index}`, card ? "flex" : "none");
    setImageSource(document, `worldCard${index}Image`, card?.thumbnailUrl ?? "");
    setText(
      document,
      `worldCard${index}Prompt`,
      card ? card.prompt || card.title : "--"
    );
  }
}

function applyInfoView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "worldTitleText", view.info.title);
  setText(document, "worldSourceText", view.info.source);
  setText(document, "transcriptText", view.info.transcript);
  setText(document, "rendererText", view.info.renderer);
  setText(document, "assetText", view.info.asset);
  setText(document, "infoDetailText", view.info.detail);
  setText(document, "infoText", view.info.detail);
  for (let index = 0; index < 4; index += 1) {
    const card = view.info.browserCards[index];
    setText(document, `worldCard${index}Title`, card?.title ?? `WORLD SLOT ${index}`);
    setText(document, `worldCard${index}Meta`, card?.meta ?? "WORLDLABS --");
    setText(document, `worldCard${index}Prompt`, card?.prompt ?? "PROMPT --");
  }
  setText(document, "worldDeleteConfirmText", view.info.deleteConfirmText);
}

function applyStatusView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "statusModeText", view.status.mode);
  setText(document, "statusText", view.status.message);
  setText(document, "browserStatusText", view.status.browser);
  setText(document, "healthText", view.status.health);
}

export function configureHolodeckPanelControls(
  controls: HolodeckPanelControls
): void {
  holodeckControls = controls;
}

function signalBrowserUpdate(
  controls: HolodeckPanelControls,
  message = "WorldLabs browser updated."
): void {
  controls.state.setStatusMessage(message);
}

function setBrowserLoading(
  controls: HolodeckPanelControls,
  message: string
): void {
  browserState = {
    ...openWorldLabsBrowser(browserState),
    isLoading: true,
    errorMessage: ""
  };
  signalBrowserUpdate(controls, message);
}

async function refreshWorldLabsWorlds(
  controls: HolodeckPanelControls,
  options: { append?: boolean } = {}
): Promise<void> {
  if (!controls.api.listWorldLabsWorlds) {
    browserState = failWorldLabsBrowser(
      openWorldLabsBrowser(browserState),
      "WorldLabs browser API unavailable."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
    return;
  }

  const pageToken =
    options.append && browserState.nextPageToken
      ? browserState.nextPageToken
      : undefined;

  setBrowserLoading(
    controls,
    pageToken ? "Loading next WorldLabs page." : "Loading WorldLabs worlds."
  );

  try {
    const page = await controls.api.listWorldLabsWorlds({
      pageSize: browserState.pageSize,
      ...(pageToken ? { pageToken } : {})
    });
    browserState = loadWorldLabsPage(
      browserState,
      filterHiddenWorldLabsWorlds(page, browserState.hiddenDeletedWorldIds),
      { append: options.append === true }
    );
    signalBrowserUpdate(controls, "WorldLabs worlds loaded.");
  } catch (error) {
    browserState = failWorldLabsBrowser(
      browserState,
      error instanceof Error ? error.message : "WorldLabs list unavailable."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
  }
}

async function loadSelectedWorldLabsWorld(
  controls: HolodeckPanelControls
): Promise<void> {
  if (!browserState.selectedWorldId || !browserState.canLoadSelectedWorld) {
    signalBrowserUpdate(controls, "Select a renderable WorldLabs world.");
    return;
  }

  if (!controls.api.getWorldLabsWorld) {
    browserState = failWorldLabsBrowser(
      browserState,
      "WorldLabs load API unavailable."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
    return;
  }

  panelSession.isGenerating = true;
  controls.state.forceState("Generating");
  signalBrowserUpdate(controls, "Loading selected WorldLabs world.");

  try {
    const world = await controls.api.getWorldLabsWorld(browserState.selectedWorldId);
    await controls.renderer.load(world);
    controls.renderer.show();
    if (hasSplatSource(world)) {
      controls.setShellVisible(false);
    }
    panelSession.transcript = world.prompt || world.transcript;
    panelSession.rendererLabel = hasSplatSource(world) ? "Splat" : "Panorama";
    panelSession.loadedWorld = {
      title: world.displayName || world.worldId,
      source: "WORLD LABS",
      assetLabel: hasSplatSource(world) ? "SPZ" : "PANO",
      worldId: world.worldId
    };
    panelSession.worldReadyAt = Date.now();
    controls.state.forceState("Ready");
    signalBrowserUpdate(
      controls,
      `WorldLabs world ready: ${world.displayName || world.worldId}`
    );
  } catch (error) {
    browserState = failWorldLabsBrowser(
      browserState,
      error instanceof Error ? error.message : "WorldLabs world unavailable."
    );
    controls.state.setError(browserState.errorMessage);
  } finally {
    panelSession.isGenerating = false;
  }
}

async function deletePendingWorldLabsWorld(
  controls: HolodeckPanelControls
): Promise<void> {
  if (!browserState.pendingDeleteWorldId) {
    signalBrowserUpdate(controls, "Select a WorldLabs world to delete.");
    return;
  }

  if (!controls.api.deleteWorldLabsWorld) {
    browserState = failWorldLabsBrowser(
      browserState,
      "WorldLabs delete API unavailable."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
    return;
  }

  const pendingWorldId = browserState.pendingDeleteWorldId;
  signalBrowserUpdate(controls, "Deleting WorldLabs world.");

  try {
    const result = await controls.api.deleteWorldLabsWorld(pendingWorldId);
    if (result.deleted) {
      browserState = markWorldDeleted(browserState, result.worldId);
      signalBrowserUpdate(controls, "WorldLabs world deleted.");
      return;
    }

    browserState = failWorldLabsBrowser(
      browserState,
      "WorldLabs delete did not complete."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
  } catch (error) {
    browserState = failWorldLabsBrowser(
      browserState,
      error instanceof Error ? error.message : "WorldLabs delete failed."
    );
    signalBrowserUpdate(controls, browserState.errorMessage);
  }
}

function cancelWorldLabsBrowser(controls: HolodeckPanelControls): void {
  browserState = createWorldLabsBrowserState({ pageSize: browserState.pageSize });
  signalBrowserUpdate(controls, "WorldLabs browser closed.");
}

function bindClick(
  document: UIKitDocument,
  id: string,
  onClick: () => void | Promise<void>
): () => void {
  const element = document.getElementById(id) as
    | {
        addEventListener: (event: "click", callback: () => void) => void;
        removeEventListener: (event: "click", callback: () => void) => void;
      }
    | null;

  if (!element) {
    return () => {};
  }

  const callback = () => {
    void onClick();
  };
  element.addEventListener("click", callback);

  return () => element.removeEventListener("click", callback);
}

export class PanelSystem extends createSystem({
  statusPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", STATUS_PANEL_CONFIG)],
  },
  opsPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", OPS_PANEL_CONFIG)],
  },
  infoPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", INFO_PANEL_CONFIG)],
  },
}) {
  init() {
    const panelCleanups = new Map<number, () => void>();

    this.cleanupFuncs.push(() => {
      panelCleanups.forEach((cleanup) => cleanup());
      panelCleanups.clear();
    });

    const clearPanel = (entity: { index: number }) => {
      panelCleanups.get(entity.index)?.();
      panelCleanups.delete(entity.index);
    };

    this.queries.statusPanel.subscribe("disqualify", clearPanel);
    this.queries.opsPanel.subscribe("disqualify", clearPanel);
    this.queries.infoPanel.subscribe("disqualify", clearPanel);

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
      const cardCleanups = [0, 1, 2, 3].map((index) =>
        bindClick(document, `worldCard${index}`, () => {
          const world = browserState.worlds[index];
          if (!world) {
            return;
          }

          browserState = selectWorldLabsWorld(browserState, world.worldId);
          signalBrowserUpdate(
            controls,
            `Selected ${world.displayName || world.worldId}.`
          );
        })
      );

      panelCleanups.set(entity.index, () => {
        cardCleanups.forEach((cleanup) => cleanup());
        unsubscribeState();
        stopClock();
      });
    });

    this.queries.opsPanel.subscribe("qualify", (entity) => {
      panelCleanups.get(entity.index)?.();

      const document = PanelDocument.data.document[
        entity.index
      ] as UIKitDocument;
      if (!document) {
        return;
      }

      const recordButton = document.getElementById("recordButton") as UIKit.Text;
      const loadSplatButton = document.getElementById(
        "loadSplatButton"
      ) as UIKit.Text;
      const resetButton = document.getElementById("resetButton") as UIKit.Text;
      const controls = holodeckControls;

      if (!recordButton || !loadSplatButton || !resetButton || !controls) {
        return;
      }

      const update = () => applyOpsView(document, currentPanelView(controls));
      opsPanelUpdate = update;
      const unsubscribeState = controls.state.subscribe(update);
      const stopClock = startPanelClock(update);
      const browserControlCleanups = [
        bindClick(document, "browseWorldsButton", () =>
          refreshWorldLabsWorlds(controls)
        ),
        bindClick(document, "refreshWorldsButton", () =>
          refreshWorldLabsWorlds(controls)
        ),
        bindClick(document, "prevWorldsButton", () =>
          refreshWorldLabsWorlds(controls)
        ),
        bindClick(document, "nextWorldsButton", () =>
          refreshWorldLabsWorlds(controls, { append: true })
        ),
        bindClick(document, "loadWorldButton", () =>
          loadSelectedWorldLabsWorld(controls)
        ),
        bindClick(document, "deleteWorldButton", () => {
          browserState = confirmWorldDelete(browserState);
          signalBrowserUpdate(controls, "Confirm WorldLabs delete.");
        }),
        bindClick(document, "confirmDeleteButton", () =>
          deletePendingWorldLabsWorld(controls)
        ),
        bindClick(document, "cancelBrowserButton", () =>
          cancelWorldLabsBrowser(controls)
        ),
        ...Array.from({ length: 9 }, (_, index) =>
          bindClick(document, `worldCard${index}`, async () => {
            const world = browserState.worlds[index];
            if (!world) {
              return;
            }

            browserState = selectWorldLabsWorld(browserState, world.worldId);
            signalBrowserUpdate(
              controls,
              `Selected ${world.displayName || world.worldId}.`
            );
            await loadSelectedWorldLabsWorld(controls);
          })
        ),
        ...Array.from({ length: 9 }, (_, index) =>
          bindClick(document, `worldDelete${index}`, () => {
            const world = browserState.worlds[index];
            if (!world) {
              return;
            }

            browserState = confirmWorldDelete(browserState, world.worldId);
            signalBrowserUpdate(controls, "Confirm WorldLabs delete.");
          })
        )
      ];

      const onRecordClick = async () => {
        if (controls.recorder.isRecording) {
          await stopVoicePromptAndGenerateWorld();
        } else {
          await startVoicePromptRecording();
        }
      };

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

        resetGeneratedWorldPanelSession();
        controls.renderer.hide();
        controls.setShellVisible(true);
        controls.state.clearErrorAndReturnToIdle();
        update();
      };

      const onLoadSplatClick = () => {
        if (panelSession.isGenerating) {
          controls.state.setStatusMessage("Generation in progress.");
          update();
          return;
        }

        controls.state.setStatusMessage("Choose a local SPZ file.");
        update();
        controls.openLocalSplatFilePicker();
      };

      recordButton.addEventListener("click", onRecordClick);
      loadSplatButton.addEventListener("click", onLoadSplatClick);
      resetButton.addEventListener("click", onResetClick);

      if (!hasRequestedInitialWorldLabsBrowse) {
        hasRequestedInitialWorldLabsBrowse = true;
        void refreshWorldLabsWorlds(controls);
      }

      panelCleanups.set(entity.index, () => {
        recordButton.removeEventListener("click", onRecordClick);
        loadSplatButton.removeEventListener("click", onLoadSplatClick);
        resetButton.removeEventListener("click", onResetClick);
        browserControlCleanups.forEach((cleanup) => cleanup());
        unsubscribeState();
        stopClock();
        if (opsPanelUpdate === update) {
          opsPanelUpdate = null;
        }
      });
    });
  }
}
