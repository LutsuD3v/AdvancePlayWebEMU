/**
 * SettingsManager.js
 * Gerenciador de configurações e preferências do usuário com persistência em localStorage.
 */

const STORAGE_KEY = 'advanceplay_settings_v1';

export const DEFAULT_KEYMAP = {
  // GBA Button : Keyboard code
  A: 'KeyZ',
  B: 'KeyX',
  L: 'KeyA',
  R: 'KeyS',
  START: 'Enter',
  SELECT: 'ShiftRight', // or ShiftLeft
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight'
};

export const DEFAULT_SETTINGS = {
  // Controles de teclado (Key codes do KeyboardEvent.code)
  keymap: { ...DEFAULT_KEYMAP },

  // Mapeamento alternativo secundário comum
  keymapAlt: {
    SELECT: 'ShiftLeft',
    A: 'KeyK',
    B: 'KeyJ',
    L: 'KeyU',
    R: 'KeyI'
  },

  // Áudio
  volume: 1.0,
  muted: false,

  // Vídeo
  filter: 'pixelated', // 'pixelated' | 'smooth' | 'scanlines'
  displayMode: 'contain', // 'contain' | '1x' | '2x' | '3x'

  // Controles virtuais de toque
  touchControls: {
    mode: 'auto', // 'auto' (detecta toque) | 'always' | 'hidden'
    scale: 1.0, // 0.8 | 1.0 | 1.2
    opacity: 0.75, // 0.3 a 1.0
    haptic: true
  },

  // Interface e desempenho
  showFps: false
};

export class SettingsManager {
  constructor() {
    this.settings = this.load();
    this.listeners = new Set();
  }

  /**
   * Carrega configurações salvas no localStorage
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        keymap: { ...DEFAULT_SETTINGS.keymap, ...(parsed.keymap || {}) },
        keymapAlt: { ...DEFAULT_SETTINGS.keymapAlt, ...(parsed.keymapAlt || {}) },
        touchControls: { ...DEFAULT_SETTINGS.touchControls, ...(parsed.touchControls || {}) }
      };
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Salva configurações no localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notify();
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
    }
  }

  /**
   * Obtém o valor de uma configuração
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Atualiza uma chave de configuração
   */
  set(key, value) {
    this.settings[key] = value;
    this.save();
  }

  /**
   * Atualiza configurações de toque
   */
  setTouchOption(key, value) {
    this.settings.touchControls = {
      ...this.settings.touchControls,
      [key]: value
    };
    this.save();
  }

  /**
   * Atualiza tecla mapeada
   */
  setKeyBinding(gbaButton, keyCode) {
    if (this.settings.keymap[gbaButton] !== undefined) {
      this.settings.keymap[gbaButton] = keyCode;
      this.save();
    }
  }

  /**
   * Restaura todas as configurações aos padrões de fábrica
   */
  resetToDefaults() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.save();
  }

  /**
   * Registra ouvinte para mudanças de configurações
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Notifica ouvintes
   */
  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this.settings);
      } catch (e) {
        console.warn('Erro no ouvinte de configuração:', e);
      }
    }
  }
}
