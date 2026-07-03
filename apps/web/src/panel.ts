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

interface HolodeckPanelControls {
  state: HolodeckStateMachine;
  recorder: BrowserVoiceRecorder;
  coordinator: VoiceToWorldCoordinator;
  renderer: WorldRenderer;
}

let holodeckControls: HolodeckPanelControls | null = null;

export function configureHolodeckPanelControls(
  controls: HolodeckPanelControls
): void {
  holodeckControls = controls;
}

export class PanelSystem extends createSystem({
  statusPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "./ui/holodeck/statusPanel.json")],
  },
}) {
  init() {
    const panelCleanups = new Map<number, () => void>();

    this.cleanupFuncs.push(() => {
      panelCleanups.forEach((cleanup) => cleanup());
      panelCleanups.clear();
    });

    this.queries.statusPanel.subscribe("disqualify", (entity) => {
      panelCleanups.get(entity.index)?.();
      panelCleanups.delete(entity.index);
    });

    this.queries.statusPanel.subscribe("qualify", (entity) => {
      panelCleanups.get(entity.index)?.();

      const document = PanelDocument.data.document[
        entity.index
      ] as UIKitDocument;
      if (!document) {
        return;
      }

      const statusText = document.getElementById("statusText") as UIKit.Text;
      const recordButton = document.getElementById("recordButton") as UIKit.Text;
      const resetButton = document.getElementById("resetButton") as UIKit.Text;
      const controls = holodeckControls;

      if (!statusText || !recordButton || !resetButton || !controls) {
        return;
      }

      const setStatus = (message: string) => {
        statusText.setProperties({ text: message });
      };
      const setRecordLabel = (message: string) => {
        recordButton.setProperties({ text: message });
      };
      let isGenerating = false;

      const unsubscribeState = controls.state.subscribe((snapshot) => {
        if (snapshot.errorMessage) {
          setStatus(snapshot.errorMessage);
          setRecordLabel("Record");
          return;
        }

        setStatus(statusMessageFor(snapshot.current));
      });

      const onRecordClick = async () => {
        if (isGenerating) {
          setStatus("Generation in progress.");
          return;
        }

        try {
          if (!controls.recorder.isRecording) {
            await controls.recorder.start();
            controls.state.forceState("ListeningForCommand");
            setStatus("Listening for world prompt.");
            setRecordLabel("Generate");
            return;
          }

          setRecordLabel("Record");
          setStatus("Preparing world generation.");
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
          setStatus("Generation in progress.");
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

      recordButton.addEventListener("click", onRecordClick);
      resetButton.addEventListener("click", onResetClick);

      panelCleanups.set(entity.index, () => {
        recordButton.removeEventListener("click", onRecordClick);
        resetButton.removeEventListener("click", onResetClick);
        unsubscribeState();
      });
    });
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
