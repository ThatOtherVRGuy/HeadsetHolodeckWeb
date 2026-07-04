import {
  createSystem,
  PanelUI,
  PanelDocument,
  eq,
  UIKitDocument,
  UIKit,
} from "@iwsdk/core";
import type {
  HolodeckStateMachine,
  HolodeckStateSnapshot
} from "./holodeck/state/holodeckState";
import type { BrowserVoiceRecorder } from "./holodeck/voice/browserVoiceRecorder";
import type { VoiceToWorldCoordinator } from "./holodeck/coordinator/voiceToWorldCoordinator";
import type { WorldRenderer } from "./holodeck/rendering/worldRenderer";

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
      const statusText = document?.getElementById("statusText") as UIKit.Text;
      if (!document || !controls || !statusText) {
        return;
      }

      const unsubscribeState = controls.state.subscribe((snapshot) => {
        statusText.setProperties({ text: summaryStatusMessage(snapshot) });
      });

      panelCleanups.set(entity.index, unsubscribeState);
    });

    this.queries.infoPanel.subscribe("qualify", (entity) => {
      panelCleanups.get(entity.index)?.();

      const document = PanelDocument.data.document[
        entity.index
      ] as UIKitDocument;
      const controls = holodeckControls;
      const infoText = document?.getElementById("infoText") as UIKit.Text;
      if (!document || !controls || !infoText) {
        return;
      }

      const unsubscribeState = controls.state.subscribe((snapshot) => {
        infoText.setProperties({ text: detailStatusMessage(snapshot) });
      });

      panelCleanups.set(entity.index, unsubscribeState);
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

      const setRecordLabel = (message: string) => {
        recordButton.setProperties({ text: message });
      };
      let isGenerating = false;

      const unsubscribeState = controls.state.subscribe((snapshot) => {
        if (snapshot.errorMessage) {
          setRecordLabel("Record");
          return;
        }
      });

      const onRecordClick = async () => {
        if (isGenerating) {
          controls.state.setStatusMessage("Generation in progress.");
          return;
        }

        try {
          if (!controls.recorder.isRecording) {
            await controls.recorder.start();
            controls.state.forceState("ListeningForCommand");
            controls.state.setStatusMessage("Listening for world prompt.");
            setRecordLabel("Generate");
            return;
          }

          setRecordLabel("Record");
          controls.state.setStatusMessage("Preparing world generation.");
          const audio = await controls.recorder.stop();
          isGenerating = true;
          await controls.coordinator.generateFromAudio(audio);
        } catch (error) {
          controls.state.setError(
            error instanceof Error ? error.message : "Voice recording failed."
          );
        } finally {
          isGenerating = false;
        }
      };

      const onResetClick = async () => {
        if (isGenerating) {
          controls.state.setStatusMessage("Generation in progress.");
          return;
        }

        try {
          await controls.recorder.cancel();
        } catch (error) {
          controls.state.setError(
            error instanceof Error ? error.message : "Voice recording failed."
          );
          return;
        }

        setRecordLabel("Record");
        controls.renderer.hide();
        controls.state.clearErrorAndReturnToIdle();
      };

      const onLoadSplatClick = () => {
        if (isGenerating) {
          controls.state.setStatusMessage("Generation in progress.");
          return;
        }

        controls.state.setStatusMessage("Choose a local SPZ file.");
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
      });
    });
  }
}

function summaryStatusMessage(snapshot: HolodeckStateSnapshot): string {
  if (snapshot.errorMessage) {
    return snapshot.errorMessage;
  }

  return snapshot.statusMessage || statusMessageFor(snapshot.current);
}

function detailStatusMessage(snapshot: HolodeckStateSnapshot): string {
  if (snapshot.errorMessage) {
    return `Error: ${snapshot.errorMessage}`;
  }

  switch (snapshot.current) {
    case "Idle":
      return "Awaiting voice prompt or local SPZ.";
    case "ListeningForCommand":
      return "Listening for the world prompt.";
    case "Interpreting":
      return "Transcribing captured audio.";
    case "Generating":
      return snapshot.statusMessage || "Generating world.";
    case "Ready":
      return snapshot.statusMessage || "World ready.";
    default:
      return snapshot.statusMessage || statusMessageFor(snapshot.current);
  }
}

function statusMessageFor(state: string): string {
  switch (state) {
    case "Idle":
      return "Holodeck systems standing by.";
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
