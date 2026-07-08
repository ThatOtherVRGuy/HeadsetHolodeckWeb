import {
  AssetManifest,
  AssetType,
  SessionMode,
  AssetManager,
  World,
  Interactable,
  PanelUI,
  LocomotionSystem,
  SlideSystem,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

import {
  configureHolodeckPanelControls,
  PanelSystem,
  setLoadedWorldPanelInfo,
  setPanelWorldLoadInProgress
} from "./panel.js";

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
import type { WorldResult } from "./holodeck/world/worldResult";
import {
  localSplatRenderUrl,
  localSplatUrlFromSearch
} from "./holodeck/world/localSplatUrl";

const apiBaseUrl = "http://localhost:4817";
const XR_SLIDING_SPEED_METERS_PER_SECOND = 0.35;
const XR_LOCOMOTION_TUNING_ATTEMPTS = 20;

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
  tuneXrLocomotion(world);

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
  let activeBrowserSplatObjectUrl: string | null = null;
  let activeLocalSplatLoadId = 0;
  const isActiveLocalSplatLoad = (loadId: number) =>
    loadId === activeLocalSplatLoadId;
  const shouldAcceptRendererStatus = (statusWorld: WorldResult) => {
    if (!isManualLocalSplatWorld(statusWorld)) {
      return true;
    }

    const statusLocalUrl = statusWorld.localSplat?.publicUrl;
    if (!statusLocalUrl) {
      return true;
    }

    const activeRenderUrl = window.holodeck?.localSplatStatus.renderUrl ?? null;
    return (
      statusLocalUrl === activeRenderUrl ||
      statusLocalUrl === activeBrowserSplatObjectUrl
    );
  };
  const splatRenderer = new SplatRenderer(generatedWorldRoot, world.renderer, {
    onStatus: (message, statusWorld) => {
      if (shouldAcceptRendererStatus(statusWorld)) {
        state.setStatusMessage(message);
      }
    }
  });
  const worldRenderer = new PreferredWorldRenderer(
    splatRenderer,
    panoramaRenderer,
  );
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
    openLocalSplatFilePicker: () => localSplatFileInput.click(),
    api
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
      const loadId = ++activeLocalSplatLoadId;
      const renderUrl = localSplatRenderUrl(url, apiBaseUrl);
      setPanelWorldLoadInProgress(true);
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
        if (!isActiveLocalSplatLoad(loadId)) {
          return;
        }

        worldRenderer.show();
        setLoadedWorldPanelInfo({
          title: url,
          source: "LOCAL SPZ",
          assetLabel: url
        });
        state.forceState("Ready");
        state.setStatusMessage(`Local splat ready: ${url}`);
        window.holodeck!.localSplatStatus = {
          state: "ready",
          url,
          renderUrl
        };
        console.log("[Holodeck] local splat ready", { url, renderUrl });
      } catch (error) {
        if (!isActiveLocalSplatLoad(loadId)) {
          return;
        }

        window.holodeck!.localSplatStatus = {
          state: "error",
          url,
          renderUrl,
          error: error instanceof Error ? error.message : String(error)
        };
        setLoadedWorldPanelInfo(null);
        throw error;
      } finally {
        if (isActiveLocalSplatLoad(loadId)) {
          setPanelWorldLoadInProgress(false);
        }
      }
    },
    loadLocalSplatFile: async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".spz")) {
        throw new Error("Choose an .spz file.");
      }

      const loadId = ++activeLocalSplatLoadId;
      const objectUrl = URL.createObjectURL(file);
      setPanelWorldLoadInProgress(true);
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
        if (!isActiveLocalSplatLoad(loadId)) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        worldRenderer.show();
        setLoadedWorldPanelInfo({
          title: file.name,
          source: "LOCAL SPZ",
          assetLabel: file.name
        });
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
        if (!isActiveLocalSplatLoad(loadId)) {
          return;
        }

        window.holodeck!.localSplatStatus = {
          state: "error",
          url: file.name,
          renderUrl: objectUrl,
          error: error instanceof Error ? error.message : String(error)
        };
        setLoadedWorldPanelInfo(null);
        throw error;
      } finally {
        if (isActiveLocalSplatLoad(loadId)) {
          setPanelWorldLoadInProgress(false);
        }
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

  const createSpatialPanel = (
    config: string,
    panel: typeof shell.placement.statusPanel,
    maxWidth: number,
    maxHeight: number
  ) => {
    const entity = world
      .createTransformEntity()
      .addComponent(PanelUI, {
        config,
        maxHeight,
        maxWidth,
      })
      .addComponent(Interactable);
    placePanelForShellComposition(entity.object3D!, camera, {
      panel,
      statusPanel: shell.placement.statusPanel,
      generatedWorld: shell.placement.generatedWorld
    });
  };

  createSpatialPanel(
    "./ui/holodeck/opsPanel.json",
    shell.placement.opsPanel,
    0.68,
    0.62
  );
  createSpatialPanel(
    "./ui/holodeck/infoPanel.json",
    shell.placement.infoPanel,
    0.78,
    0.5
  );
  createSpatialPanel(
    "./ui/holodeck/statusPanel.json",
    shell.placement.statusPanel,
    1.05,
    0.26
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

function tuneXrLocomotion(world: World): void {
  const locomotionSystem = world.getSystem(LocomotionSystem);
  locomotionSystem.config.slidingSpeed.value = XR_SLIDING_SPEED_METERS_PER_SECOND;

  let attempts = 0;
  const applyToSlideSystem = () => {
    attempts += 1;

    try {
      const slideSystem = world.getSystem(SlideSystem);
      slideSystem.config.maxSpeed.value = XR_SLIDING_SPEED_METERS_PER_SECOND;
      console.info("[Holodeck] XR locomotion speed tuned", {
        metersPerSecond: XR_SLIDING_SPEED_METERS_PER_SECOND,
        attempts
      });
      return;
    } catch {
      if (attempts < XR_LOCOMOTION_TUNING_ATTEMPTS) {
        window.setTimeout(applyToSlideSystem, 50);
        return;
      }

      console.warn("[Holodeck] XR slide system was not available for speed tuning", {
        metersPerSecond: XR_SLIDING_SPEED_METERS_PER_SECOND,
        attempts
      });
    }
  };

  applyToSlideSystem();
}

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

function isManualLocalSplatWorld(world: { raw: unknown }): boolean {
  const raw = world.raw as { source?: unknown } | null;
  return raw?.source === "local-spz" || raw?.source === "browser-file-spz";
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
