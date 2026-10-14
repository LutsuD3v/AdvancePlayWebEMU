/**
 * TypeScript definitions for Jeffrey Pfau's GBA.js core
 */

export interface GBAKeypad {
  A: number;
  B: number;
  SELECT: number;
  START: number;
  RIGHT: number;
  LEFT: number;
  UP: number;
  DOWN: number;
  R: number;
  L: number;
  currentDown: number;
  eatInput: boolean;
  gamepads: Gamepad[];
  keyboardHandler: (e: KeyboardEvent) => void;
  gamepadHandler: (gamepad: Gamepad) => void;
  pollGamepads: () => void;
  registerHandlers: () => void;
}

export interface GBAAudio {
  context: AudioContext | null;
  masterEnable: boolean;
  masterVolume: number;
  enabled: boolean;
  clear: () => void;
  pause: (paused: boolean) => void;
}

export interface GBACartridge {
  title: string | null;
  code: string | null;
  maker: string | null;
  memory: ArrayBuffer;
  saveType: string | null;
}

export interface GBASavedata {
  buffer: ArrayBuffer;
  view: DataView;
}

export interface GBAMMU {
  cart: GBACartridge | null;
  save: GBASavedata | null;
  loadRom: (rom: ArrayBuffer, process?: boolean) => GBACartridge | null;
  loadBios: (bios: ArrayBuffer, real?: boolean) => void;
  loadSavedata: (data: ArrayBuffer) => void;
  saveNeedsFlush: () => boolean;
  flushSave: () => void;
  clear: () => void;
}

export interface GBAVideo {
  drawCallback: () => void;
  vblankCallback: () => void;
  setBacking: (context: CanvasRenderingContext2D) => void;
}

export interface GBAInstance {
  LOG_ERROR: number;
  LOG_WARN: number;
  LOG_STUB: number;
  LOG_INFO: number;
  LOG_DEBUG: number;
  SYS_ID: string;
  logLevel: number;
  rom: GBACartridge | null;
  audio: GBAAudio;
  video: GBAVideo;
  keypad: GBAKeypad;
  mmu: GBAMMU;
  paused: boolean;
  throttle: number;
  reportFPS: ((fps: number) => void) | null;
  context: CanvasRenderingContext2D | null;
  targetCanvas: HTMLCanvasElement | null;
  indirectCanvas: HTMLCanvasElement | null;
  setCanvas: (canvas: HTMLCanvasElement) => void;
  setCanvasDirect: (canvas: HTMLCanvasElement) => void;
  setBios: (bios: ArrayBuffer, real?: boolean) => void;
  setRom: (rom: ArrayBuffer) => boolean;
  hasRom: () => boolean;
  loadRomFromFile: (file: File, callback?: (result: boolean) => void) => void;
  setSavedata: (data: ArrayBuffer) => void;
  loadSavedataFromFile: (file: File) => void;
  decodeSavedata: (str: string) => void;
  encodeBase64: (view: DataView) => string;
  decodeBase64: (str: string) => ArrayBuffer;
  downloadSavedata: () => void;
  storeSavedata: () => void;
  retrieveSavedata: () => boolean;
  reset: () => void;
  step: () => void;
  advanceFrame: () => void;
  waitFrame: () => boolean;
  pause: () => void;
  runStable: () => void;
  setLogger?: (logger: (level: number, error: string | Error) => void) => void;
}

declare global {
  interface Window {
    GameBoyAdvance: new () => GBAInstance;
  }
}
