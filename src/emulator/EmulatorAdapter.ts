/**
 * EmulatorAdapter.ts
 * Camada de integração independente que conecta a interface do usuário ao núcleo GBA.js (Jeffrey Pfau).
 * Fornece API consistente para ciclo de vida, carregamento de ROMs, controles unificados,
 * áudio, persistência com IndexedDB e exportação/importação de saves.
 */

import { GBAInstance, GBACartridge } from '../types/gba';
import {
  saveGameData,
  getGameData,
  saveRecentGame,
  AppSettings,
  getAppSettings,
} from '../storage/db';

export enum GBAButton {
  A = 0,
  B = 1,
  SELECT = 2,
  START = 3,
  RIGHT = 4,
  LEFT = 5,
  UP = 6,
  DOWN = 7,
  R = 8,
  L = 9,
}

export type InputSource = 'keyboard' | 'touch' | 'gamepad';

export interface EmulatorStatus {
  isInitialized: boolean;
  hasRom: boolean;
  isRunning: boolean;
  isPaused: boolean;
  fps: number;
  gameTitle: string;
  gameCode: string;
  gameMaker: string;
  saveType: string;
  gamepadConnected: boolean;
  gamepadName: string;
}

export interface EmulatorCallbacks {
  onStatusChange?: (status: EmulatorStatus) => void;
  onFpsUpdate?: (fps: number) => void;
  onSaveUpdated?: (title: string) => void;
  onError?: (message: string) => void;
}

export class EmulatorAdapter {
  private gba: GBAInstance | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private biosLoaded = false;
  private biosBuffer: ArrayBuffer | null = null;
  private callbacks: EmulatorCallbacks = {};
  private currentRomData: ArrayBuffer | null = null;
  private currentFileName = '';
  private currentFps = 0;
  private settings: AppSettings;

  // Unified Input System
  // For each button 0..9, track which sources currently press it
  private inputSources: Array<Record<InputSource, boolean>> = Array.from({ length: 10 }, () => ({
    keyboard: false,
    touch: false,
    gamepad: false,
  }));

  // Gamepad polling loop
  private gamepadAnimId: number | null = null;
  private activeGamepadIndex: number | null = null;
  private connectedGamepadName = '';

  constructor(callbacks: EmulatorCallbacks = {}) {
    this.callbacks = callbacks;
    this.settings = getAppSettings();
  }

  /**
   * Atualiza as configurações ativas na camada de emulação
   */
  public updateSettings(newSettings: AppSettings): void {
    this.settings = newSettings;
    if (this.gba && this.gba.audio) {
      this.gba.audio.masterEnable = !newSettings.audioMuted;
      this.gba.audio.masterVolume = newSettings.audioVolume;
    }
  }

  /**
   * Inicializa o núcleo GBA.js e vincula ao elemento Canvas fornecido
   */
  public async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    if (!window.GameBoyAdvance) {
      throw new Error(
        'GBA.js não foi encontrado no escopo global. Verifique o carregamento dos scripts do núcleo.'
      );
    }

    try {
      this.gba = new window.GameBoyAdvance();
      this.gba.logLevel = this.gba.LOG_ERROR;
      this.gba.setCanvas(this.canvas);

      // Desativa os handlers padrão de teclado e gamepad do GBA.js para usar nosso sistema unificado e remapeável
      if (this.gba.keypad) {
        this.gba.keypad.eatInput = false;
        // Anula o pollGamepads nativo para evitar conflito com nossa Gamepad API unificada
        this.gba.keypad.pollGamepads = () => {};
      }

      // Hook no salvamento para persistir automaticamente no IndexedDB
      const originalStoreSavedata = this.gba.storeSavedata.bind(this.gba);
      this.gba.storeSavedata = () => {
        originalStoreSavedata();
        this.persistSaveToIndexedDB();
      };

      // Carrega a BIOS open-source inclusa no projeto
      await this.loadDefaultBios();

      // Monitor de FPS
      this.gba.reportFPS = (fps: number) => {
        this.currentFps = Math.round(fps);
        this.callbacks.onFpsUpdate?.(this.currentFps);
      };

      // Configura tratamento de erros do núcleo
      if (this.gba.setLogger) {
        this.gba.setLogger((_level, error) => {
          const errStr = typeof error === 'string' ? error : error?.message || 'Erro no emulador';
          console.warn('[GBA.js Kernel]:', errStr);
        });
      }

      // Aplica configurações de áudio iniciais
      if (this.gba.audio) {
        this.gba.audio.masterEnable = !this.settings.audioMuted;
        this.gba.audio.masterVolume = this.settings.audioVolume;
      }

      // Inicializa escuta de gamepads
      this.setupGamepadListeners();

      this.notifyStatusChange();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao inicializar o núcleo do emulador.';
      this.callbacks.onError?.(msg);
      throw err;
    }
  }

  /**
   * Carrega a BIOS de código aberto (Jeffrey Pfau)
   */
  private async loadDefaultBios(): Promise<void> {
    if (this.biosLoaded && this.biosBuffer) return;
    try {
      const res = await fetch('/gbajs/resources/bios.bin');
      if (!res.ok) throw new Error(`Status ${res.status} ao carregar bios.bin`);
      const buffer = await res.arrayBuffer();
      this.biosBuffer = buffer;
      if (this.gba) {
        this.gba.setBios(buffer);
        this.biosLoaded = true;
      }
    } catch (err) {
      console.warn('Aviso: BIOS padrão não carregada via fetch, tentando modo fallback.', err);
    }
  }

  /**
   * Valida se o buffer corresponde a uma ROM válida do Game Boy Advance
   * Verifica o byte mágico 0x96 na posição 0xB2 do cabeçalho da Nintendo
   */
  public validateRom(buffer: ArrayBuffer): {
    valid: boolean;
    title: string;
    code: string;
    maker: string;
    error?: string;
  } {
    if (!buffer || buffer.byteLength < 0xc0) {
      return { valid: false, title: '', code: '', maker: '', error: 'Arquivo muito pequeno ou vazio.' };
    }

    const view = new DataView(buffer);
    const magic = view.getUint8(0xb2);
    if (magic !== 0x96) {
      return {
        valid: false,
        title: '',
        code: '',
        maker: '',
        error: 'Cabeçalho inválido: o arquivo não parece ser uma ROM de Game Boy Advance válida.',
      };
    }

    // Extrai título (12 bytes em 0xA0)
    let title = '';
    for (let i = 0; i < 12; i++) {
      const charCode = view.getUint8(0xa0 + i);
      if (charCode === 0) break;
      if (charCode >= 32 && charCode <= 126) {
        title += String.fromCharCode(charCode);
      }
    }

    // Extrai código do jogo (4 bytes em 0xAC)
    let code = '';
    for (let i = 0; i < 4; i++) {
      const charCode = view.getUint8(0xac + i);
      if (charCode === 0) break;
      code += String.fromCharCode(charCode);
    }

    // Extrai código do fabricante (2 bytes em 0xB0)
    let maker = '';
    for (let i = 0; i < 2; i++) {
      const charCode = view.getUint8(0xb0 + i);
      if (charCode === 0) break;
      maker += String.fromCharCode(charCode);
    }

    return {
      valid: true,
      title: title.trim() || 'GBA Game',
      code: code.trim(),
      maker: maker.trim(),
    };
  }

  /**
   * Carrega uma ROM a partir de um ArrayBuffer e nome de arquivo
   */
  public async loadRom(buffer: ArrayBuffer, fileName: string): Promise<boolean> {
    if (!this.gba) {
      throw new Error('Emulador não inicializado.');
    }

    // Validação prévia
    const check = this.validateRom(buffer);
    if (!check.valid) {
      this.callbacks.onError?.(check.error || 'ROM incompatível.');
      return false;
    }

    // Interrompe execução prévia e limpa recursos
    this.stop();

    this.currentRomData = buffer;
    this.currentFileName = fileName;

    // Assegura que a BIOS esteja carregada
    if (!this.biosLoaded && this.biosBuffer) {
      this.gba.setBios(this.biosBuffer);
    }

    // Define a ROM no núcleo do GBA.js
    const loaded = this.gba.setRom(buffer);
    if (!loaded) {
      this.callbacks.onError?.('O núcleo GBA.js não conseguiu carregar a ROM informada.');
      return false;
    }

    // Tenta carregar dados salvos do IndexedDB para este cartucho
    const cart = this.gba.mmu.cart;
    let hasSave = false;
    if (cart && cart.code) {
      try {
        const savedRecord = await getGameData(cart.code);
        if (savedRecord && savedRecord.data) {
          this.gba.setSavedata(savedRecord.data);
          hasSave = true;
        }
      } catch (err) {
        console.warn('Erro ao restaurar jogo salvo do IndexedDB:', err);
      }

      // Adiciona ao histórico de jogos recentes
      saveRecentGame({
        id: cart.code,
        title: cart.title || check.title,
        gameCode: cart.code,
        maker: cart.maker || check.maker,
        fileName,
        fileSize: buffer.byteLength,
        hasSave,
      });
    }

    // Retoma o AudioContext caso esteja suspenso pelo navegador
    await this.resumeAudioContext();

    // Inicia a emulação estável
    this.gba.runStable();

    this.notifyStatusChange();
    return true;
  }

  /**
   * Inicia ou retoma a execução estável da emulação
   */
  public async start(): Promise<void> {
    if (!this.gba || !this.gba.hasRom()) return;
    await this.resumeAudioContext();
    this.gba.runStable();
    this.notifyStatusChange();
  }

  /**
   * Pausa a emulação
   */
  public pause(): void {
    if (!this.gba || !this.gba.hasRom()) return;
    this.gba.pause();
    this.notifyStatusChange();
  }

  /**
   * Alterna entre Pausa e Execução
   */
  public async togglePause(): Promise<void> {
    if (!this.gba || !this.gba.hasRom()) return;
    if (this.gba.paused) {
      await this.start();
    } else {
      this.pause();
    }
  }

  /**
   * Reinicia o jogo atual
   */
  public async reset(): Promise<void> {
    if (!this.gba || !this.currentRomData) return;
    this.gba.pause();
    this.gba.reset();
    if (this.currentRomData) {
      this.gba.setRom(this.currentRomData);
      // Restaura save do IndexedDB se existir
      const cart = this.gba.mmu.cart;
      if (cart && cart.code) {
        const saved = await getGameData(cart.code);
        if (saved && saved.data) {
          this.gba.setSavedata(saved.data);
        }
      }
    }
    await this.start();
    this.notifyStatusChange();
  }

  /**
   * Verifica se há uma ROM carregada no emulador
   */
  public hasRom(): boolean {
    return !!(this.gba && this.gba.hasRom && this.gba.hasRom());
  }

  /**
   * Para a execução e limpa o jogo ativo
   */
  public stop(): void {
    if (this.gba) {
      this.gba.pause();
    }
    // Libera entradas
    this.resetAllInputs();
    this.notifyStatusChange();
  }

  /**
   * Encerra completamente o emulador e libera recursos
   */
  public destroy(): void {
    this.stop();
    if (this.gamepadAnimId) {
      cancelAnimationFrame(this.gamepadAnimId);
      this.gamepadAnimId = null;
    }
    this.removeGamepadListeners();
    this.gba = null;
    this.canvas = null;
  }

  /**
   * Garante que o AudioContext seja retomado após interação do usuário
   */
  public async resumeAudioContext(): Promise<void> {
    if (this.gba && this.gba.audio && this.gba.audio.context) {
      if (this.gba.audio.context.state === 'suspended') {
        try {
          await this.gba.audio.context.resume();
        } catch (err) {
          console.warn('Erro ao retomar AudioContext:', err);
        }
      }
    }
  }

  /**
   * Ajusta o volume do áudio (0.0 a 1.0)
   */
  public setVolume(volume: number): void {
    this.settings.audioVolume = Math.max(0, Math.min(1, volume));
    if (this.gba && this.gba.audio) {
      this.gba.audio.masterVolume = this.settings.audioVolume;
    }
  }

  /**
   * Ativa ou desativa o áudio (mute)
   */
  public setMuted(muted: boolean): void {
    this.settings.audioMuted = muted;
    if (this.gba && this.gba.audio) {
      this.gba.audio.masterEnable = !muted;
      if (muted) {
        this.gba.audio.pause(true);
      } else if (!this.gba.paused) {
        this.gba.audio.pause(false);
      }
    }
  }

  // ==========================================
  // SISTEMA UNIFICADO DE ENTRADA (UNIFIED INPUT)
  // ==========================================

  /**
   * Define o estado de um botão GBA para uma fonte de entrada específica (keyboard, touch, gamepad).
   * O botão físico/virtual do emulador permanecerá pressionado até que TODAS as fontes o liberem.
   */
  public setButtonState(button: GBAButton, isPressed: boolean, source: InputSource): void {
    if (!this.gba || !this.gba.keypad) return;

    const slot = this.inputSources[button];
    if (!slot) return;

    slot[source] = isPressed;

    // Recalcula o bitmask do keypad
    // No hardware GBA (e no GBA.js):
    // 0 = Pressionado (Active Low)
    // 1 = Liberado
    let currentDown = this.gba.keypad.currentDown;

    const anyPressed = slot.keyboard || slot.touch || slot.gamepad;
    const bit = 1 << button;

    if (anyPressed) {
      currentDown &= ~bit;
    } else {
      currentDown |= bit;
    }

    this.gba.keypad.currentDown = currentDown;
  }

  /**
   * Libera todas as entradas ativas de uma fonte de entrada (ex: ao desconectar gamepad)
   */
  public releaseSource(source: InputSource): void {
    for (let button = 0; button < 10; button++) {
      this.setButtonState(button as GBAButton, false, source);
    }
  }

  /**
   * Reseta todas as entradas de todas as fontes
   */
  public resetAllInputs(): void {
    if (!this.gba || !this.gba.keypad) return;
    for (let button = 0; button < 10; button++) {
      this.inputSources[button] = { keyboard: false, touch: false, gamepad: false };
    }
    this.gba.keypad.currentDown = 0x03ff; // Todos os 10 botões liberados
  }

  // ==========================================
  // GAMEPAD API (CONTROLES FÍSICOS)
  // ==========================================

  private onGamepadConnected = (e: GamepadEvent) => {
    this.activeGamepadIndex = e.gamepad.index;
    this.connectedGamepadName = e.gamepad.id;
    this.startGamepadLoop();
    this.notifyStatusChange();
  };

  private onGamepadDisconnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === e.gamepad.index) {
      this.activeGamepadIndex = null;
      this.connectedGamepadName = '';
      this.releaseSource('gamepad');
      this.notifyStatusChange();
    }
  };

  private setupGamepadListeners(): void {
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.startGamepadLoop();
  }

  private removeGamepadListeners(): void {
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  private startGamepadLoop = () => {
    if (this.gamepadAnimId) return;

    const poll = () => {
      this.pollGamepads();
      this.gamepadAnimId = requestAnimationFrame(poll);
    };
    this.gamepadAnimId = requestAnimationFrame(poll);
  };

  private pollGamepads(): void {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let pad: Gamepad | null = null;

    if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
      pad = gamepads[this.activeGamepadIndex];
    } else {
      for (let i = 0; i < gamepads.length; i++) {
        const candidate = gamepads[i];
        if (candidate) {
          pad = candidate;
          this.activeGamepadIndex = i;
          this.connectedGamepadName = candidate.id;
          break;
        }
      }
    }

    if (!pad) {
      return;
    }

    const activePad = pad;
    const map = this.settings.gamepadMapping;
    const deadzone = map.axisDeadzone || 0.35;

    // Botões de Ação
    const isBtnPressed = (idx: number) => {
      const b = activePad.buttons[idx];
      return typeof b === 'object' ? b.pressed || b.value > 0.4 : b > 0.4;
    };

    this.setButtonState(GBAButton.A, isBtnPressed(map.A), 'gamepad');
    this.setButtonState(GBAButton.B, isBtnPressed(map.B), 'gamepad');
    this.setButtonState(GBAButton.SELECT, isBtnPressed(map.SELECT), 'gamepad');
    this.setButtonState(GBAButton.START, isBtnPressed(map.START), 'gamepad');
    this.setButtonState(GBAButton.L, isBtnPressed(map.L), 'gamepad');
    this.setButtonState(GBAButton.R, isBtnPressed(map.R), 'gamepad');

    // Direcional Digital (D-Pad)
    let up = isBtnPressed(map.UP);
    let down = isBtnPressed(map.DOWN);
    let left = isBtnPressed(map.LEFT);
    let right = isBtnPressed(map.RIGHT);

    // Suporte ao Analógico Esquerdo com Deadzone
    if (pad.axes && pad.axes.length >= 2) {
      const axisX = pad.axes[0];
      const axisY = pad.axes[1];
      if (axisX < -deadzone) left = true;
      if (axisX > deadzone) right = true;
      if (axisY < -deadzone) up = true;
      if (axisY > deadzone) down = true;
    }

    this.setButtonState(GBAButton.UP, up, 'gamepad');
    this.setButtonState(GBAButton.DOWN, down, 'gamepad');
    this.setButtonState(GBAButton.LEFT, left, 'gamepad');
    this.setButtonState(GBAButton.RIGHT, right, 'gamepad');
  }

  // ==========================================
  // GERENCIAMENTO DE JOGOS SALVOS (SAVES)
  // ==========================================

  /**
   * Salva o progresso atual do cartucho no IndexedDB
   */
  private async persistSaveToIndexedDB(): Promise<void> {
    if (!this.gba || !this.gba.mmu || !this.gba.mmu.save || !this.gba.mmu.cart) return;
    const cart = this.gba.mmu.cart;
    if (!cart.code) return;

    try {
      const sram = this.gba.mmu.save;
      await saveGameData(cart.code, cart.title || this.currentFileName, sram.buffer);
      this.callbacks.onSaveUpdated?.(cart.title || this.currentFileName);
    } catch (err) {
      console.warn('Falha ao persistir save no IndexedDB:', err);
    }
  }

  /**
   * Exporta os dados de jogo salvo para um arquivo .sav baixável
   */
  public exportSaveFile(): boolean {
    if (!this.gba || !this.gba.mmu) return false;
    const sram = this.gba.mmu.save;
    if (!sram || !sram.buffer || sram.buffer.byteLength === 0) {
      this.callbacks.onError?.('Nenhum dado salvo disponível para este jogo.');
      return false;
    }

    const code = this.gba.mmu.cart?.code || 'game';
    const blob = new Blob([sram.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}.sav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Importa dados de jogo salvo a partir de um arquivo .sav fornecido pelo usuário
   */
  public async importSaveFile(file: File): Promise<boolean> {
    if (!this.gba || !this.gba.hasRom()) {
      this.callbacks.onError?.('Abra uma ROM antes de importar um jogo salvo.');
      return false;
    }

    try {
      const buffer = await file.arrayBuffer();
      this.gba.setSavedata(buffer);
      await this.persistSaveToIndexedDB();
      this.callbacks.onSaveUpdated?.('Jogo salvo importado com sucesso!');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao importar arquivo de save.';
      this.callbacks.onError?.(msg);
      return false;
    }
  }

  /**
   * Captura uma imagem da tela atual do jogo
   */
  public takeScreenshot(): string | null {
    if (!this.gba) return null;
    const canvas = this.gba.indirectCanvas || this.canvas;
    if (!canvas) return null;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const title = this.gba.mmu.cart?.title || 'gba';
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_screenshot.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return dataUrl;
    } catch (err) {
      console.warn('Erro ao gerar screenshot:', err);
      return null;
    }
  }

  /**
   * Notifica a interface sobre mudanças no status do emulador
   */
  private notifyStatusChange(): void {
    const cart = this.gba?.mmu?.cart;
    const status: EmulatorStatus = {
      isInitialized: !!this.gba,
      hasRom: !!this.gba?.hasRom(),
      isRunning: !!this.gba?.hasRom() && !this.gba?.paused,
      isPaused: !!this.gba?.paused,
      fps: this.currentFps,
      gameTitle: cart?.title || '',
      gameCode: cart?.code || '',
      gameMaker: cart?.maker || '',
      saveType: cart?.saveType || 'Auto-detect',
      gamepadConnected: this.activeGamepadIndex !== null,
      gamepadName: this.connectedGamepadName,
    };
    this.callbacks.onStatusChange?.(status);
  }

  public getStatus(): EmulatorStatus {
    const cart = this.gba?.mmu?.cart;
    return {
      isInitialized: !!this.gba,
      hasRom: !!this.gba?.hasRom(),
      isRunning: !!this.gba?.hasRom() && !this.gba?.paused,
      isPaused: !!this.gba?.paused,
      fps: this.currentFps,
      gameTitle: cart?.title || '',
      gameCode: cart?.code || '',
      gameMaker: cart?.maker || '',
      saveType: cart?.saveType || 'Auto-detect',
      gamepadConnected: this.activeGamepadIndex !== null,
      gamepadName: this.connectedGamepadName,
    };
  }
}
