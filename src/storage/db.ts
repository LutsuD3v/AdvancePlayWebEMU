/**
 * IndexedDB and localStorage persistent storage for GBA saves, recent games, and settings
 */

export interface SavedGameRecord {
  gameCode: string;
  title: string;
  data: ArrayBuffer;
  updatedAt: number;
  sizeBytes: number;
}

export interface RecentGameItem {
  id: string; // gameCode or generated id
  title: string;
  gameCode: string;
  maker: string;
  fileName: string;
  fileSize: number;
  lastPlayed: number;
  hasSave: boolean;
}

export interface KeyMapping {
  UP: string;
  DOWN: string;
  LEFT: string;
  RIGHT: string;
  A: string;
  B: string;
  L: string;
  R: string;
  START: string;
  SELECT: string;
}

export interface GamepadMapping {
  A: number; // default button index
  B: number;
  SELECT: number;
  START: number;
  L: number;
  R: number;
  UP: number;
  DOWN: number;
  LEFT: number;
  RIGHT: number;
  axisDeadzone: number;
}

export interface AppSettings {
  videoFilter: 'pixelated' | 'smooth';
  videoScale: 'fit' | '2x' | '3x';
  audioVolume: number; // 0.0 to 1.0
  audioMuted: boolean;
  touchControls: boolean;
  touchOpacity: number; // 0.2 to 1.0
  touchSize: 'sm' | 'md' | 'lg';
  keyMapping: KeyMapping;
  gamepadMapping: GamepadMapping;
}

export const DEFAULT_KEY_MAPPING: KeyMapping = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  A: 'KeyZ',
  B: 'KeyX',
  L: 'KeyA',
  R: 'KeyS',
  START: 'Enter',
  SELECT: 'ShiftRight',
};

export const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
  A: 0, // Cross / A
  B: 1, // Circle / B
  SELECT: 8, // Back / Select / Share
  START: 9, // Start / Options / Menu
  L: 4, // L1 / LB
  R: 5, // R1 / RB
  UP: 12, // D-pad Up
  DOWN: 13, // D-pad Down
  LEFT: 14, // D-pad Left
  RIGHT: 15, // D-pad Right
  axisDeadzone: 0.35,
};

export const DEFAULT_SETTINGS: AppSettings = {
  videoFilter: 'pixelated',
  videoScale: 'fit',
  audioVolume: 0.8,
  audioMuted: false,
  touchControls: true,
  touchOpacity: 0.8,
  touchSize: 'md',
  keyMapping: DEFAULT_KEY_MAPPING,
  gamepadMapping: DEFAULT_GAMEPAD_MAPPING,
};

const DB_NAME = 'AdvancePlay_DB';
const DB_VERSION = 1;
const SAVES_STORE = 'game_saves';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB não suportado neste navegador.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SAVES_STORE)) {
        db.createObjectStore(SAVES_STORE, { keyPath: 'gameCode' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGameData(
  gameCode: string,
  title: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVES_STORE, 'readwrite');
    const store = tx.objectStore(SAVES_STORE);
    const record: SavedGameRecord = {
      gameCode,
      title: title || 'Game Boy Advance Game',
      data: data.slice(0),
      updatedAt: Date.now(),
      sizeBytes: data.byteLength,
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getGameData(gameCode: string): Promise<SavedGameRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVES_STORE, 'readonly');
    const store = tx.objectStore(SAVES_STORE);
    const req = store.get(gameCode);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGameData(gameCode: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVES_STORE, 'readwrite');
    const store = tx.objectStore(SAVES_STORE);
    const req = store.delete(gameCode);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listAllSaves(): Promise<Array<{ gameCode: string; title: string; updatedAt: number; sizeBytes: number }>> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVES_STORE, 'readonly');
    const store = tx.objectStore(SAVES_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const records: SavedGameRecord[] = req.result || [];
      resolve(
        records.map((r) => ({
          gameCode: r.gameCode,
          title: r.title,
          updatedAt: r.updatedAt,
          sizeBytes: r.sizeBytes,
        }))
      );
    };
    req.onerror = () => reject(req.error);
  });
}

const RECENT_GAMES_KEY = 'advanceplay_recent_games_v1';
const SETTINGS_KEY = 'advanceplay_settings_v1';

export function getRecentGames(): RecentGameItem[] {
  try {
    const json = localStorage.getItem(RECENT_GAMES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export function saveRecentGame(item: Omit<RecentGameItem, 'lastPlayed'>): void {
  try {
    const list = getRecentGames();
    const existingIndex = list.findIndex(
      (g) => (g.gameCode && g.gameCode === item.gameCode) || g.fileName === item.fileName
    );
    const record: RecentGameItem = {
      ...item,
      lastPlayed: Date.now(),
    };
    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
    }
    list.unshift(record);
    const trimmed = list.slice(0, 10);
    localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Erro ao salvar histórico de jogos recentes:', err);
  }
}

export function removeRecentGame(id: string): void {
  try {
    const list = getRecentGames().filter((g) => g.id !== id && g.gameCode !== id);
    localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Erro ao remover jogo do histórico:', err);
  }
}

export function getAppSettings(): AppSettings {
  try {
    const json = localStorage.getItem(SETTINGS_KEY);
    if (!json) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(json);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keyMapping: { ...DEFAULT_KEY_MAPPING, ...(parsed.keyMapping || {}) },
      gamepadMapping: { ...DEFAULT_GAMEPAD_MAPPING, ...(parsed.gamepadMapping || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Erro ao salvar preferências:', err);
  }
}
