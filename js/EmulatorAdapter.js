/**
 * EmulatorAdapter.js
 * Camada de integração entre a interface moderna do AdvancePlay e o núcleo GBA.js (Jeffrey Pfau).
 * Fornece API consistente para ciclo de vida, carregamento de ROM, vídeo, áudio, salvamento e controles.
 */

// BIOS open-source de 220 bytes desenvolvida por Jeffrey Pfau (endrift/gbajs)
const BUILTIN_BIOS_BASE64 = 'BgAA6v7//+oFAADq/v//6v7//+oAAKDhDAAA6v7//+oC86DjAABd4wHToAMg0E0CAEAt6QIAXuUEAFDjCQAACwUAUOMHAAALAEC96A7wsOEPUC3pAQOg4wDgj+IE8BDlD1C96ATwXuIQQC3pBNBN4rAQzeEBQ6DjAkyE4rAA1OGyAM3hsBDd4QEAgOGwAMThAUOg4x8AoOMA8CnhAACg4wEDxOXTAKDjAPAp4bgAVOGwEN3hABAR4AAQIRC4EEQR8///CgFDoOMCTITisgDd4bAAxOEE0I3iEIC96A==';

export class EmulatorAdapter {
  constructor() {
    this.gba = null;
    this.canvas = null;
    this.state = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'running' | 'paused' | 'error'
    this.romInfo = null;
    this.currentFps = 0;
    this.biosLoaded = false;
    this.volume = 1.0;
    this.isMuted = false;

    // Callbacks
    this.onStateChange = null;
    this.onFpsUpdate = null;
    this.onError = null;
    this.onSaveFlush = null;

    // Definição dos botões do Game Boy Advance de acordo com o keypad.js do GBA.js
    this.BUTTONS = {
      A: 0,
      B: 1,
      SELECT: 2,
      START: 3,
      RIGHT: 4,
      LEFT: 5,
      UP: 6,
      DOWN: 7,
      R: 8,
      L: 9
    };
  }

  /**
   * Converte string base64 para ArrayBuffer
   */
  static base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Inicializa o núcleo GBA.js associando-o ao canvas e carregando a BIOS.
   * @param {HTMLCanvasElement} canvasElement 
   */
  async init(canvasElement) {
    this.canvas = canvasElement;

    if (typeof window.GameBoyAdvance !== 'function') {
      const err = new Error('Núcleo GBA.js não encontrado no escopo global.');
      this._setState('error', err);
      throw err;
    }

    try {
      this.gba = new window.GameBoyAdvance();

      // Configura nível de log e captura erros
      this.gba.logLevel = this.gba.LOG_ERROR;
      this.gba.setLogger((level, message) => {
        console.warn('[GBA.js Core]', level, message);
        if (level === this.gba.LOG_ERROR) {
          if (this.onError) {
            this.onError(typeof message === 'string' ? message : (message?.message || 'Erro de emulação no núcleo'));
          }
        }
      });

      // Configura tela direta no canvas
      this.gba.setCanvas(this.canvas);

      // Desativa o eatInput padrão do keypad original pois nosso InputManager gerencia unificado
      if (this.gba.keypad) {
        this.gba.keypad.eatInput = false;
        // Sobrescreve o poller padrão legado para evitar sobrescrita de teclas pelo Gamepad API antigo
        this.gba.keypad.pollGamepads = () => {};
      }

      // Configura contador de FPS do núcleo
      this.gba.reportFPS = (fps) => {
        this.currentFps = Math.round(fps);
        if (this.onFpsUpdate) {
          this.onFpsUpdate(this.currentFps);
        }
      };

      // Carrega BIOS open-source
      await this._loadBios();

      this._setState('unloaded');
      return true;
    } catch (err) {
      console.error('Falha ao inicializar EmulatorAdapter:', err);
      this._setState('error', err);
      throw err;
    }
  }

  /**
   * Carrega o arquivo de BIOS open-source do GBA.js
   */
  async _loadBios() {
    try {
      const response = await fetch('/core/resources/bios.bin');
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        this.gba.setBios(buffer);
        this.biosLoaded = true;
        return;
      }
    } catch (e) {
      console.warn('Não foi possível carregar /core/resources/bios.bin via fetch, usando fallback interno:', e);
    }

    // Fallback: usar BIOS embutida base64
    const buffer = EmulatorAdapter.base64ToArrayBuffer(BUILTIN_BIOS_BASE64);
    this.gba.setBios(buffer);
    this.biosLoaded = true;
  }

  /**
   * Define o estado interno e notifica ouvintes
   */
  _setState(newState, detail = null) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(this.state, detail);
    }
  }

  /**
   * Carrega uma ROM a partir de um ArrayBuffer.
   * @param {ArrayBuffer} romBuffer
   * @param {string} fileName
   */
  loadRom(romBuffer, fileName = 'jogo.gba') {
    if (!this.gba) {
      throw new Error('Emulador não foi inicializado.');
    }

    this._setState('loading');

    // Validação mínima de cabeçalho GBA: tamanho mínimo e byte mágico de integridade na posição 0xB2 (0x96)
    if (!romBuffer || romBuffer.byteLength < 0xC0) {
      const err = new Error('Arquivo de ROM muito pequeno ou inválido para GBA.');
      this._setState('error', err);
      throw err;
    }

    const view = new DataView(romBuffer);
    const magic = view.getUint8(0xB2);
    if (magic !== 0x96) {
      console.warn('Aviso: byte mágico do cabeçalho GBA (0xB2) difere do padrão 0x96. Tentando carregar mesmo assim...');
    }

    // Garante parada limpa da sessão anterior
    this.pause();
    this.gba.reset();

    // Carrega no MMU
    const success = this.gba.setRom(romBuffer);
    if (!success || !this.gba.hasRom()) {
      const err = new Error('O núcleo GBA.js não reconheceu o formato desta ROM.');
      this._setState('error', err);
      throw err;
    }

    // Extrai metadados da ROM
    const cart = this.gba.mmu?.cart || {};
    this.romInfo = {
      title: (cart.title || fileName.replace(/\.[^/.]+$/, '')).trim() || 'Desconhecido',
      code: (cart.code || 'GBA').trim(),
      maker: (cart.maker || '').trim(),
      size: romBuffer.byteLength,
      fileName: fileName
    };

    this.currentRomBuffer = romBuffer;

    // Aplica volumes configurados
    this.applyAudioSettings();

    this._setState('ready', this.romInfo);
    return this.romInfo;
  }

  /**
   * Verifica se há uma ROM carregada no emulador
   * @returns {boolean}
   */
  hasRom() {
    return !!(this.gba && this.gba.hasRom && this.gba.hasRom());
  }

  /**
   * Inicia ou retoma a execução estável do emulador
   */
  start() {
    if (!this.gba || !this.hasRom()) return;

    // Retoma o AudioContext do navegador se estiver suspenso
    this.resumeAudioContext();

    this.gba.runStable();
    this._setState('running');
  }

  /**
   * Pausa a execução
   */
  pause() {
    if (!this.gba) return;
    this.gba.pause();
    this._setState('paused');
  }

  /**
   * Alterna entre rodando e pausado
   */
  togglePause() {
    if (this.state === 'running') {
      this.pause();
    } else if (this.state === 'paused' || this.state === 'ready') {
      this.start();
    }
  }

  /**
   * Reinicia a emulação do jogo atual
   */
  reset() {
    if (!this.gba || !this.hasRom()) return;

    this.pause();
    this.gba.reset();

    // Se temos a ROM em memória no MMU, recarrega limpo
    if (this.currentRomBuffer) {
      this.gba.setRom(this.currentRomBuffer);
    } else if (this.gba.rom && this.gba.rom.memory) {
      this.gba.setRom(this.gba.rom.memory);
    }

    this.start();
  }

  /**
   * Interrompe a execução e descarrega a ROM atual
   */
  unload() {
    if (!this.gba) return;
    this.pause();
    this.gba.reset();
    this.romInfo = null;
    this.currentRomBuffer = null;
    this.currentFps = 0;
    this._setState('unloaded');
  }

  /**
   * Atualiza o estado de um botão no keypad do emulador.
   * activeInputs: o bit correspondente é limpo (0) quando pressionado e setado (1) quando solto.
   * @param {number} buttonId - Índice de 0 a 9 correspondente a this.BUTTONS
   * @param {boolean} isPressed - true se estiver pressionado
   */
  setButtonState(buttonId, isPressed) {
    if (!this.gba || !this.gba.keypad) return;

    const mask = 1 << buttonId;
    if (isPressed) {
      this.gba.keypad.currentDown &= ~mask;
    } else {
      this.gba.keypad.currentDown |= mask;
    }
  }

  /**
   * Aplica diretamente a máscara completa de botões (bitmask de 10 bits ativa baixa)
   * @param {number} currentDownMask 
   */
  setKeypadMask(currentDownMask) {
    if (!this.gba || !this.gba.keypad) return;
    this.gba.keypad.currentDown = currentDownMask & 0x03FF;
  }

  /**
   * Configura o volume master de áudio (0.0 a 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyAudioSettings();
  }

  /**
   * Ativa ou desativa o mudo de áudio
   */
  setMute(isMuted) {
    this.isMuted = !!isMuted;
    this.applyAudioSettings();
  }

  /**
   * Aplica as configurações no subsistema de áudio do GBA.js
   */
  applyAudioSettings() {
    if (!this.gba || !this.gba.audio) return;
    this.gba.audio.masterEnable = !this.isMuted;
    this.gba.audio.masterVolume = this.isMuted ? 0 : this.volume;
  }

  /**
   * Retoma o contexto Web Audio na primeira interação do usuário
   */
  resumeAudioContext() {
    if (this.gba && this.gba.audio && this.gba.audio.context) {
      if (this.gba.audio.context.state === 'suspended') {
        this.gba.audio.context.resume().catch((e) => console.warn('Erro ao retomar AudioContext:', e));
      }
    }
  }

  /**
   * Retorna os dados de salvamento atuais (SRAM / Flash / EEPROM) como Uint8Array
   */
  getSaveData() {
    if (!this.gba || !this.gba.mmu || !this.gba.mmu.save) {
      return null;
    }
    const save = this.gba.mmu.save;
    if (!save.buffer) return null;
    return new Uint8Array(save.buffer);
  }

  /**
   * Injeta dados de salvamento (ex: de arquivo .sav importado ou IndexedDB)
   * @param {ArrayBuffer} arrayBuffer 
   */
  loadSaveData(arrayBuffer) {
    if (!this.gba || !this.gba.mmu) {
      throw new Error('Emulador não está carregado.');
    }
    this.gba.setSavedata(arrayBuffer);
  }

  /**
   * Captura screenshot da tela atual como Data URL PNG
   */
  takeScreenshot() {
    if (!this.canvas) return null;
    try {
      return this.canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Erro ao gerar screenshot:', e);
      return null;
    }
  }

  /**
   * Verifica se o emulador possui save pendente de gravação
   */
  saveNeedsFlush() {
    return this.gba?.mmu?.saveNeedsFlush?.() || false;
  }

  /**
   * Força a gravação de saves pendentes
   */
  flushSave() {
    if (this.gba?.mmu?.flushSave) {
      this.gba.mmu.flushSave();
    }
  }

  /**
   * Encerra todos os timers e recursos
   */
  destroy() {
    if (this.gba) {
      this.pause();
      if (this.gba.audio && this.gba.audio.context) {
        try {
          this.gba.audio.context.close();
        } catch (e) {}
      }
      this.gba = null;
    }
    this.canvas = null;
    this.state = 'unloaded';
  }
}
