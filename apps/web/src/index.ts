import {
  AssetManifest,
  AssetType,
  SessionMode,
  AssetManager,
  World,
  Interactable,
  PanelUI,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

import { configureHolodeckPanelControls, PanelSystem } from "./panel.js";

import {
  HolodeckApiClient,
  type VoiceToWorldJob,
} from "./holodeck/api/holodeckApiClient";
import {
  VoiceToWorldCoordinator,
  type VoiceToWorldProgress,
} from "./holodeck/coordinator/voiceToWorldCoordinator";
import { PanoramaRenderer } from "./holodeck/rendering/panoramaRenderer";
import { PreferredWorldRenderer } from "./holodeck/rendering/preferredWorldRenderer";
import { loadHolodeckShell } from "./holodeck/shell/shellLoader";
import { placePanelForShellComposition } from "./holodeck/shell/panelPose";
import {
  applyUserStartPose,
  HOLODECK_INITIAL_PLAYER_POSITION
} from "./holodeck/shell/startPose";
import { SplatRenderer } from "./holodeck/rendering/splatRenderer";
import { HolodeckStateMachine } from "./holodeck/state/holodeckState";
import { BrowserVoiceRecorder } from "./holodeck/voice/browserVoiceRecorder";
import {
  createBrowserFileSplatWorld,
  createLocalSplatWorld
} from "./holodeck/world/localSplatWorld";
import {
  localSplatRenderUrl,
  localSplatUrlFromSearch
} from "./holodeck/world/localSplatUrl";

const apiBaseUrl = "http://localhost:4817";

const assets: AssetManifest = {
  holodeckShell: {
    url: "/assets/unity-export/holodeck-shell/holodeck-shell.glb",
    type: AssetType.GLTF,
    priority: "critical",
  },
};

const state = new HolodeckStateMachine();
const recorder = new BrowserVoiceRecorder();
const api = new HolodeckApiClient(apiBaseUrl);
const localSplatFileInput = createLocalSplatFileInput(document);

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: {
      useWorker: true,
      initialPlayerPosition: [...HOLODECK_INITIAL_PLAYER_POSITION],
    },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  const { scene } = world;
  const { camera } = world;

  const shell = loadHolodeckShell({
    assetId: "holodeckShell",
    getGltfScene: (assetId) => AssetManager.getGLTF(assetId)?.scene ?? null,
    createTransformEntity: (object) =>
      world
        .createTransformEntity(object)
        .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC }),
  });
  state.setStatusMessage(shell.message);

  const generatedWorldRoot = shell.placement.generatedWorld.object ?? scene;
  const panoramaRenderer = new PanoramaRenderer(generatedWorldRoot);
  const splatRenderer = new SplatRenderer(generatedWorldRoot, world.renderer, {
    onStatus: (message) => state.setStatusMessage(message)
  });
  const worldRenderer = new PreferredWorldRenderer(
    splatRenderer,
    panoramaRenderer,
  );
  let activeBrowserSplatObjectUrl: string | null = null;
  const revokeActiveBrowserSplatObjectUrl = () => {
    if (!activeBrowserSplatObjectUrl) {
      return;
    }

    URL.revokeObjectURL(activeBrowserSplatObjectUrl);
    activeBrowserSplatObjectUrl = null;
  };
  const coordinator = new VoiceToWorldCoordinator({
    state,
    api,
    renderer: worldRenderer,
    onProgress: (job, progress) => {
      state.setStatusMessage(statusMessageForVoiceToWorldJob(job, progress));
    },
  });
  configureHolodeckPanelControls({
    state,
    recorder,
    coordinator,
    renderer: worldRenderer,
    openLocalSplatFilePicker: () => localSplatFileInput.click()
  });
  localSplatFileInput.addEventListener("change", () => {
    const file = localSplatFileInput.files?.[0] ?? null;
    localSplatFileInput.value = "";
    if (!file) {
      return;
    }

    window.holodeck?.loadLocalSplatFile(file).catch((error: unknown) => {
      state.setError(
        error instanceof Error ? error.message : "Local SPZ loading failed."
      );
    });
  });
  window.addEventListener("beforeunload", revokeActiveBrowserSplatObjectUrl);
  window.holodeck = {
    localSplatStatus: {
      state: "idle"
    },
    shellStatus: {
      status: shell.status,
      missingAnchors: shell.missingAnchors
    },
    loadLocalSplat: async (url: string) => {
      const renderUrl = localSplatRenderUrl(url, apiBaseUrl);
      window.holodeck!.localSplatStatus = {
        state: "loading",
        url,
        renderUrl
      };
      console.log("[Holodeck] loading local splat", { url, renderUrl });
      state.forceState("Generating");
      state.setStatusMessage(`Loading local splat ${url}`);
      try {
        await worldRenderer.load(createLocalSplatWorld(renderUrl));
        worldRenderer.show();
        state.forceState("Ready");
        state.setStatusMessage(`Local splat ready: ${url}`);
        window.holodeck!.localSplatStatus = {
          state: "ready",
          url,
          renderUrl
        };
        console.log("[Holodeck] local splat ready", { url, renderUrl });
      } catch (error) {
        window.holodeck!.localSplatStatus = {
          state: "error",
          url,
          renderUrl,
          error: error instanceof Error ? error.message : String(error)
        };
        throw error;
      }
    },
    loadLocalSplatFile: async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".spz")) {
        throw new Error("Choose an .spz file.");
      }

      const objectUrl = URL.createObjectURL(file);
      window.holodeck!.localSplatStatus = {
        state: "loading",
        url: file.name,
        renderUrl: objectUrl
      };
      console.log("[Holodeck] loading browser splat file", {
        fileName: file.name,
        size: file.size
      });
      state.forceState("Generating");
      state.setStatusMessage(`Loading local splat ${file.name}`);

      try {
        await worldRenderer.load(createBrowserFileSplatWorld(file, objectUrl));
        worldRenderer.show();
        revokeActiveBrowserSplatObjectUrl();
        activeBrowserSplatObjectUrl = objectUrl;
        state.forceState("Ready");
        state.setStatusMessage(`Local splat ready: ${file.name}`);
        window.holodeck!.localSplatStatus = {
          state: "ready",
          url: file.name,
          renderUrl: objectUrl
        };
        console.log("[Holodeck] browser splat file ready", {
          fileName: file.name,
          size: file.size
        });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        window.holodeck!.localSplatStatus = {
          state: "error",
          url: file.name,
          renderUrl: objectUrl,
          error: error instanceof Error ? error.message : String(error)
        };
        throw error;
      }
    },
    listLocalSplats: async () => {
      const response = await fetch(`${apiBaseUrl}/generated-worlds`);
      if (!response.ok) {
        throw new Error(
          `Local splat list failed: HTTP ${response.status} ${await response.text()}`
        );
      }

      return response.json();
    }
  };
  console.log("[Holodeck] shell status", window.holodeck.shellStatus);

  applyUserStartPose({
    player: world.player,
    camera,
    userStart: shell.placement.userStart,
    generatedWorld: shell.placement.generatedWorld,
  });

  const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "./ui/holodeck/statusPanel.json",
      maxHeight: 0.42,
      maxWidth: 1.05,
    })
    .addComponent(Interactable);
  placePanelForShellComposition(
    panelEntity.object3D!,
    camera,
    {
      statusPanel: shell.placement.statusPanel,
      generatedWorld: shell.placement.generatedWorld
    }
  );

  world.registerSystem(PanelSystem);

  const startupSplatUrl = localSplatUrlFromSearch(window.location.search);
  console.log("[Holodeck] startup local splat query", {
    search: window.location.search,
    startupSplatUrl
  });
  if (startupSplatUrl) {
    requestAnimationFrame(() => {
      window.holodeck?.loadLocalSplat(startupSplatUrl).catch((error: unknown) => {
        state.setError(
          error instanceof Error ? error.message : "Local splat loading failed."
        );
      });
    });
  }
});

function statusMessageForVoiceToWorldJob(
  job: VoiceToWorldJob,
  progress: VoiceToWorldProgress,
): string {
  const message = job.progress?.description ?? job.message ?? "Generating world.";

  if (
    (job.status === "queued" || job.status === "running") &&
    job.stage === "world-generation"
  ) {
    const dots = ".".repeat((progress.pollCount % 3) + 1);
    const elapsedSeconds = Math.max(0, Math.floor(progress.elapsedMs / 1000));
    return `${message}${dots} Poll ${progress.pollCount}, ${elapsedSeconds}s`;
  }

  return message;
}

declare global {
  interface Window {
    holodeck?: {
      localSplatStatus: {
        state: "idle" | "loading" | "ready" | "error";
        url?: string;
        renderUrl?: string;
        error?: string;
      };
      shellStatus: {
        status: "loaded" | "missing-asset" | "missing-anchors";
        missingAnchors: string[];
      };
      loadLocalSplat(url: string): Promise<void>;
      loadLocalSplatFile(file: File): Promise<void>;
      listLocalSplats(): Promise<unknown>;
    };
  }
}

function createLocalSplatFileInput(ownerDocument: Document): HTMLInputElement {
  const input = ownerDocument.createElement("input");
  input.type = "file";
  input.accept = ".spz";
  input.style.display = "none";
  input.setAttribute("aria-hidden", "true");
  ownerDocument.body.appendChild(input);
  return input;
}
