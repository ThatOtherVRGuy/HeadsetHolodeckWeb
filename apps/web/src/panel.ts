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
import {
  buildPanelViewModel,
  type LoadedWorldPanelInfo,
  type PanelViewModel
} from "./holodeck/ui/panelViewModel";

interface HolodeckPanelControls {
  state: HolodeckStateMachine;
  recorder: BrowserVoiceRecorder;
  coordinator: VoiceToWorldCoordinator;
  renderer: WorldRenderer;
  openLocalSplatFilePicker: () => void;
}

let holodeckControls: HolodeckPanelControls | null = null;
const STATUS_PANEL_CONFIG = "./ui/holodeck/statusPanel.json";
const OPS_PANEL_CONFIG = "./ui/holodeck/opsPanel.json";
const INFO_PANEL_CONFIG = "./ui/holodeck/infoPanel.json";
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
  setText(document, "infoText", view.info.detail);
}

function applyStatusView(document: UIKitDocument, view: PanelViewModel): void {
  setText(document, "statusModeText", view.status.mode);
  setText(document, "statusText", view.status.message);
  setText(document, "healthText", view.status.health);
}

export function configureHolodeckPanelControls(
  controls: HolodeckPanelControls
): void {
  holodeckControls = controls;
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

      panelCleanups.set(entity.index, () => {
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

          if (world === null) {
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

      panelCleanups.set(entity.index, () => {
        recordButton.removeEventListener("click", onRecordClick);
        loadSplatButton.removeEventListener("click", onLoadSplatClick);
        resetButton.removeEventListener("click", onResetClick);
        unsubscribeState();
        stopClock();
      });
    });
  }
}
