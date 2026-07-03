import {
  AssetManifest,
  AssetType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SessionMode,
  SRGBColorSpace,
  AssetManager,
  World,
} from "@iwsdk/core";

import {
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PanelUI,
  PlaybackMode,
  ScreenSpace,
} from "@iwsdk/core";

import { EnvironmentType, LocomotionEnvironment } from "@iwsdk/core";

import { configureHolodeckPanelControls, PanelSystem } from "./panel.js";

import { Robot } from "./robot.js";

import { RobotSystem } from "./robot.js";
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
import { SplatRenderer } from "./holodeck/rendering/splatRenderer";
import { HolodeckStateMachine } from "./holodeck/state/holodeckState";
import { BrowserVoiceRecorder } from "./holodeck/voice/browserVoiceRecorder";
import { createLocalSplatWorld } from "./holodeck/world/localSplatWorld";
import {
  localSplatRenderUrl,
  localSplatUrlFromSearch
} from "./holodeck/world/localSplatUrl";

const apiBaseUrl = "http://localhost:4817";

const assets: AssetManifest = {
  chimeSound: {
    url: "/audio/chime.mp3",
    type: AssetType.Audio,
    priority: "background",
  },
  webxr: {
    url: "/textures/webxr.png",
    type: AssetType.Texture,
    priority: "critical",
  },
  environmentDesk: {
    url: "./gltf/environmentDesk/environmentDesk.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
  plantSansevieria: {
    url: "./gltf/plantSansevieria/plantSansevieria.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
  robot: {
    url: "./gltf/robot/robot.gltf",
    type: AssetType.GLTF,
    priority: "critical",
  },
};

const state = new HolodeckStateMachine();
const recorder = new BrowserVoiceRecorder();
const api = new HolodeckApiClient(apiBaseUrl);

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  const { scene } = world;
  const { camera } = world;
  const panoramaRenderer = new PanoramaRenderer(scene);
  const splatRenderer = new SplatRenderer(scene, world.renderer);
  const worldRenderer = new PreferredWorldRenderer(
    splatRenderer,
    panoramaRenderer,
  );
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
  });
  window.holodeck = {
    loadLocalSplat: async (url: string) => {
      const renderUrl = localSplatRenderUrl(url, apiBaseUrl);
      state.forceState("Generating");
      state.setStatusMessage(`Loading local splat ${url}`);
      await worldRenderer.load(createLocalSplatWorld(renderUrl));
      worldRenderer.show();
      state.forceState("Ready");
      state.setStatusMessage(`Local splat ready: ${url}`);
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

  camera.position.set(-4, 1.5, -6);
  camera.rotateY(-Math.PI * 0.75);

  const { scene: envMesh } = AssetManager.getGLTF("environmentDesk")!;
  envMesh.rotateY(Math.PI);
  envMesh.position.set(0, -0.1, 0);
  world
    .createTransformEntity(envMesh)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  const { scene: plantMesh } = AssetManager.getGLTF("plantSansevieria")!;

  plantMesh.position.set(1.2, 0.85, -1.8);

  world
    .createTransformEntity(plantMesh)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
    });

  const { scene: robotMesh } = AssetManager.getGLTF("robot")!;
  // defaults for AR
  robotMesh.position.set(-1.2, 0.4, -1.8);
  robotMesh.scale.setScalar(1);

  robotMesh.position.set(-1.2, 0.95, -1.8);
  robotMesh.scale.setScalar(0.5);

  world
    .createTransformEntity(robotMesh)
    .addComponent(Interactable)
    .addComponent(Robot)
    .addComponent(AudioSource, {
      src: "./audio/chime.mp3",
      maxInstances: 3,
      playbackMode: PlaybackMode.FadeRestart,
    });

  const panelEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: "./ui/holodeck/statusPanel.json",
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: "20px",
      left: "20px",
      height: "40%",
    });
  panelEntity.object3D!.position.set(0, 1.29, -1.9);

  const webxrLogoTexture = AssetManager.getTexture("webxr")!;
  webxrLogoTexture.colorSpace = SRGBColorSpace;
  const logoBanner = new Mesh(
    new PlaneGeometry(3.39, 0.96),
    new MeshBasicMaterial({
      map: webxrLogoTexture,
      transparent: true,
    }),
  );
  world.createTransformEntity(logoBanner);
  logoBanner.position.set(0, 1, 1.8);
  logoBanner.rotateY(Math.PI);

  world.registerSystem(PanelSystem).registerSystem(RobotSystem);

  const startupSplatUrl = localSplatUrlFromSearch(window.location.search);
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
      loadLocalSplat(url: string): Promise<void>;
      listLocalSplats(): Promise<unknown>;
    };
  }
}
