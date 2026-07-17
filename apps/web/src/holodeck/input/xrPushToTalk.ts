export interface XrPushToTalkGamepad {
  getButtonDown(id: string): boolean;
  getButtonUp(id: string): boolean;
  getButtonDownByIdx?(index: number): boolean;
  getButtonUpByIdx?(index: number): boolean;
}

export interface XrPushToTalkActions {
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
}

export interface KeyboardPushToTalkOptions {
  key?: string;
  target?: Window;
}

const B_BUTTON_COMPONENT_ID = "b-button";
const WEBXR_STANDARD_B_BUTTON_INDEX = 5;
const DEFAULT_KEYBOARD_PUSH_TO_TALK_KEY = "b";

export function updateXrPushToTalk(
  gamepad: XrPushToTalkGamepad | null | undefined,
  actions: XrPushToTalkActions
): void {
  if (!gamepad) {
    return;
  }

  if (isBButtonDown(gamepad)) {
    void actions.start();
  }

  if (isBButtonUp(gamepad)) {
    void actions.stop();
  }
}

function isBButtonDown(gamepad: XrPushToTalkGamepad): boolean {
  return (
    gamepad.getButtonDown(B_BUTTON_COMPONENT_ID) ||
    Boolean(gamepad.getButtonDownByIdx?.(WEBXR_STANDARD_B_BUTTON_INDEX))
  );
}

function isBButtonUp(gamepad: XrPushToTalkGamepad): boolean {
  return (
    gamepad.getButtonUp(B_BUTTON_COMPONENT_ID) ||
    Boolean(gamepad.getButtonUpByIdx?.(WEBXR_STANDARD_B_BUTTON_INDEX))
  );
}

export function installKeyboardPushToTalk(
  actions: XrPushToTalkActions,
  options: KeyboardPushToTalkOptions = {}
): () => void {
  const target = options.target ?? window;
  const key = (options.key ?? DEFAULT_KEYBOARD_PUSH_TO_TALK_KEY).toLowerCase();

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isPushToTalkKey(event, key) || event.repeat || isEditableTarget(event)) {
      return;
    }

    void actions.start();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!isPushToTalkKey(event, key) || isEditableTarget(event)) {
      return;
    }

    void actions.stop();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
  };
}

function isPushToTalkKey(event: KeyboardEvent, key: string): boolean {
  return event.key.toLowerCase() === key;
}

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target;

  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
