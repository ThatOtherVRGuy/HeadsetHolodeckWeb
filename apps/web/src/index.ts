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
  InputActions,
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
import { KeyboardLocomotionTracker } from "./holodeck/input/keyboardLocomotion";
import { cameraRelativeMovement } from "./holodeck/input/cameraRelativeMovement";
import {
  createHolodeckComposeController,
  isHolodeckComposeModeEnabled,
  type HolodeckComposeController,
  type HolodeckComposeTarget
} from "./holodeck/compose/composeMode";
import {
  AxesHelper,
  Object3D,
  Vector2,
  Vector3
} from "@iwsdk/core/dist/runtime/three.js";

const apiBaseUrl = "http://localhost:4817";
const XR_SLIDING_SPEED_METERS_PER_SECOND = 0.35;
const XR_LOCOMOTION_TUNING_ATTEMPTS = 20;
const HOLODECK_PLAYER_BOUNDS_RADIUS_METERS = 8;

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
const keyboardLocomotion = new KeyboardLocomotionTracker(window);

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
  installXrMovementDiagnostics(world);

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
  installBoundedHolodeckLocomotion(world, camera);

  const createSpatialPanel = (
    config: string,
    panel: typeof shell.placement.statusPanel,
    maxWidth: number,
    maxHeight: number
  ): Object3D => {
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
    return entity.object3D!;
  };

  const opsPanelObject = createSpatialPanel(
    "./ui/holodeck/opsPanel.json",
    shell.placement.opsPanel,
    1.36,
    1.24
  );
  const infoPanelObject = createSpatialPanel(
    "./ui/holodeck/infoPanel.json",
    shell.placement.infoPanel,
    1.56,
    1.0
  );
  const statusPanelObject = createSpatialPanel(
    "./ui/holodeck/statusPanel.json",
    shell.placement.statusPanel,
    1.05,
    0.26
  );

  if (isHolodeckComposeModeEnabled(window.location.search)) {
    const composeTargets = createComposeTargets({
      opsPanelObject,
      infoPanelObject,
      statusPanelObject,
      player: world.player,
      shell
    });
    addComposeHelpers(composeTargets);
    window.holodeckCompose = createHolodeckComposeController(composeTargets);
    console.info(
      "[Holodeck] compose mode enabled. Use window.holodeckCompose.list(), nudge(), rotate(), set(), snapshot(), or download().",
      window.holodeckCompose.list()
    );
  }

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
  locomotionSystem.config.slidingSpeed.value = 0;
  locomotionSystem.update = () => {};

  let attempts = 0;
  const applyToSlideSystem = () => {
    attempts += 1;

    try {
      const slideSystem = world.getSystem(SlideSystem);
      slideSystem.config.maxSpeed.value = 0;
      installHolodeckMoveAxisOverride(slideSystem);
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

function installBoundedHolodeckLocomotion(world: World, camera: Object3D): void {
  const inputAxis = new Vector2();
  const movement = new Vector3();
  const boundsCenter = new Vector3(...HOLODECK_INITIAL_PLAYER_POSITION);
  let lastTimestamp = performance.now();

  const step = (timestamp: number) => {
    const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;

    getHolodeckMoveAxis(world, inputAxis);

    if (inputAxis.lengthSq() > 0.0001) {
      cameraRelativeMovement(inputAxis, camera, movement).multiplyScalar(
        XR_SLIDING_SPEED_METERS_PER_SECOND * deltaSeconds
      );
      world.player.position.add(movement);
    }

    world.player.position.y = boundsCenter.y;
    clampPlayerToHolodeckBounds(world.player.position, boundsCenter);
    window.requestAnimationFrame(step);
  };

  window.requestAnimationFrame(step);
}

function getHolodeckMoveAxis(world: World, out: Vector2): Vector2 {
  const keyboardAxis = keyboardLocomotion.getAxis();

  if (keyboardAxis.x !== 0 || keyboardAxis.y !== 0) {
    return out.set(keyboardAxis.x, keyboardAxis.y);
  }

  const moveAxis = world.input.actions.getAxis2D(InputActions.LocomotionMove);
  return out.set(moveAxis.x, moveAxis.y);
}

function clampPlayerToHolodeckBounds(position: Vector3, boundsCenter: Vector3): void {
  const offsetX = position.x - boundsCenter.x;
  const offsetZ = position.z - boundsCenter.z;
  const distance = Math.hypot(offsetX, offsetZ);

  if (distance <= HOLODECK_PLAYER_BOUNDS_RADIUS_METERS || distance === 0) {
    return;
  }

  const scale = HOLODECK_PLAYER_BOUNDS_RADIUS_METERS / distance;
  position.x = boundsCenter.x + offsetX * scale;
  position.z = boundsCenter.z + offsetZ * scale;
}

function installHolodeckMoveAxisOverride(slideSystem: InstanceType<typeof SlideSystem>): void {
  const inputProvider = slideSystem.config.inputProvider.value as {
    getMoveAxis(out: { set(x: number, y: number): unknown }): unknown;
    holodeckMoveAxisOverrideInstalled?: boolean;
  };

  if (inputProvider.holodeckMoveAxisOverrideInstalled) {
    return;
  }

  const getIwSdkMoveAxis = inputProvider.getMoveAxis.bind(inputProvider);
  inputProvider.getMoveAxis = (out) => {
    const keyboardAxis = keyboardLocomotion.getAxis();

    if (keyboardAxis.x !== 0 || keyboardAxis.y !== 0) {
      return out.set(keyboardAxis.x, keyboardAxis.y);
    }

    return getIwSdkMoveAxis(out);
  };
  inputProvider.holodeckMoveAxisOverrideInstalled = true;
}

function installXrMovementDiagnostics(world: World): void {
  const debugState = {
    lastLoggedAt: 0,
    lastPlayerPosition: world.player.position.clone(),
    lastCameraPosition: world.camera.position.clone()
  };

  window.holodeckDebug = {
    world,
    locomotionSystem: () => world.getSystem(LocomotionSystem),
    slideSystem: () => world.getSystem(SlideSystem),
    movementSnapshot: () =>
      movementSnapshot(
        world,
        debugState.lastPlayerPosition,
        debugState.lastCameraPosition
      )
  };

  const sample = () => {
    const snapshot = movementSnapshot(
      world,
      debugState.lastPlayerPosition,
      debugState.lastCameraPosition
    );
    const moved =
      snapshot.playerDelta.lengthSq() > 0.0001 ||
      snapshot.cameraDelta.lengthSq() > 0.0001 ||
      Math.abs(snapshot.moveAxis.x) > 0.01 ||
      Math.abs(snapshot.moveAxis.y) > 0.01 ||
      Math.abs(snapshot.leftThumbstick.x) > 0.01 ||
      Math.abs(snapshot.leftThumbstick.y) > 0.01;
    const now = performance.now();

    if (moved && now - debugState.lastLoggedAt > 250) {
      console.info("[Holodeck] XR movement sample " + JSON.stringify({
        moveAxis: snapshot.moveAxis,
        leftThumbstick: snapshot.leftThumbstick,
        slideMaxSpeed: snapshot.slideMaxSpeed,
        player: snapshot.player,
        playerDelta: snapshot.playerDelta.toArray(),
        camera: snapshot.camera,
        cameraDelta: snapshot.cameraDelta.toArray(),
        sessionActive: snapshot.sessionActive
      }));
      debugState.lastLoggedAt = now;
    }

    debugState.lastPlayerPosition.copy(world.player.position);
    debugState.lastCameraPosition.copy(world.camera.position);
    window.requestAnimationFrame(sample);
  };

  window.requestAnimationFrame(sample);
}

function movementSnapshot(
  world: World,
  previousPlayerPosition: { x: number; y: number; z: number },
  previousCameraPosition: { x: number; y: number; z: number },
) {
  const moveAxis = world.input.actions.getAxis2D(InputActions.LocomotionMove);
  const leftGamepad = world.input.xr.gamepads.left;
  const leftThumbstick = leftGamepad?.getAxesValues("thumbstick") ?? { x: 0, y: 0 };
  let slideMaxSpeed: number | null = null;

  try {
    slideMaxSpeed = world.getSystem(SlideSystem).config.maxSpeed.value;
  } catch {
    slideMaxSpeed = null;
  }

  return {
    moveAxis: { x: moveAxis.x, y: moveAxis.y },
    leftThumbstick: { x: leftThumbstick.x, y: leftThumbstick.y },
    slideMaxSpeed,
    player: world.player.position.toArray(),
    playerDelta: world.player.position.clone().sub(previousPlayerPosition),
    camera: world.camera.position.toArray(),
    cameraDelta: world.camera.position.clone().sub(previousCameraPosition),
    sessionActive: Boolean(world.session)
  };
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

function createComposeTargets(options: {
  opsPanelObject: Object3D;
  infoPanelObject: Object3D;
  statusPanelObject: Object3D;
  player: Object3D;
  shell: { placement: ReturnType<typeof loadHolodeckShell>["placement"] };
}): HolodeckComposeTarget[] {
  const targets: HolodeckComposeTarget[] = [
    { name: "opsPanel", kind: "panel", object: options.opsPanelObject },
    { name: "infoPanel", kind: "panel", object: options.infoPanelObject },
    { name: "statusPanel", kind: "panel", object: options.statusPanelObject },
    { name: "spawn", kind: "spawn", object: options.player }
  ];

  addAnchorComposeTarget(targets, "opsPanelAnchor", options.shell.placement.opsPanel.object);
  addAnchorComposeTarget(targets, "infoPanelAnchor", options.shell.placement.infoPanel.object);
  addAnchorComposeTarget(targets, "statusPanelAnchor", options.shell.placement.statusPanel.object);
  addAnchorComposeTarget(targets, "userStartAnchor", options.shell.placement.userStart.object);
  addAnchorComposeTarget(targets, "generatedWorldRoot", options.shell.placement.generatedWorld.object);

  return targets;
}

function addAnchorComposeTarget(
  targets: HolodeckComposeTarget[],
  name: string,
  object: Object3D | null
): void {
  if (!object) {
    return;
  }

  targets.push({ name, kind: "anchor", object });
}

function addComposeHelpers(targets: HolodeckComposeTarget[]): void {
  for (const target of targets) {
    const size = target.kind === "spawn" ? 0.45 : 0.18;
    const helper = new AxesHelper(size);
    helper.name = `ComposeHelper_${target.name}`;
    target.object.add(helper);
  }
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
    holodeckCompose?: HolodeckComposeController;
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
