/**
 * InputManager.js
 * Sistema unificado de gerenciamento de entradas (Teclado, Toque e Gamepad).
 * Garante que um botão permaneça pressionado se qualquer uma das fontes o estiver acionando,
 * e só seja liberado quando TODAS as fontes o liberarem.
 */

export class InputManager {
  /**
   * @param {import('./EmulatorAdapter.js').EmulatorAdapter} emulatorAdapter
   * @param {import('./SettingsManager.js').SettingsManager} settingsManager
   */
  constructor(emulatorAdapter, settingsManager) {
    this.adapter = emulatorAdapter;
    this.settings = settingsManager;

    // Fontes independentes de entrada (registrando o conjunto de botões ativos em cada uma)
    this.sources = {
      keyboard: new Set(),
      touch: new Set(),
      gamepad: new Set()
    };

    // Estado unificado anterior para evitar escritas redundantes
    this.unifiedState = new Uint8Array(10); // 0=solto, 1=pressionado

    // Mapeamento de teclas reverso (código da tecla do teclado -> id do botão GBA)
    this.keyToGbaMap = new Map();
    this._rebuildKeyMap();

    // Se está em sessão de jogo ativa
    this.isEnabled = false;

    // Registra listeners de teclado e foco da janela
    this._initKeyboardListeners();
    this._initFocusListeners();

    // Atualiza mapeamento quando configurações mudarem
    this.settings.subscribe(() => {
      this._rebuildKeyMap();
    });
  }

  /**
   * Reconstrói mapa de teclas de acordo com as configurações do usuário
   */
  _rebuildKeyMap() {
    this.keyToGbaMap.clear();
    const keymap = this.settings.get('keymap') || {};
    const keymapAlt = this.settings.get('keymapAlt') || {};
    const BUTTONS = this.adapter.BUTTONS;

    for (const [btnName, keyCode] of Object.entries(keymap)) {
      if (BUTTONS[btnName] !== undefined && keyCode) {
        this.keyToGbaMap.set(keyCode, BUTTONS[btnName]);
      }
    }

    for (const [btnName, keyCode] of Object.entries(keymapAlt)) {
      if (BUTTONS[btnName] !== undefined && keyCode) {
        this.keyToGbaMap.set(keyCode, BUTTONS[btnName]);
      }
    }
  }

  /**
   * Ativa ou desativa o recebimento de entradas para o jogo
   */
  setEnabled(enabled) {
    this.isEnabled = !!enabled;
    if (!this.isEnabled) {
      this.releaseAll();
    }
  }

  /**
   * Atualiza entrada vinda de uma fonte específica (keyboard, touch, gamepad)
   * @param {'keyboard' | 'touch' | 'gamepad'} sourceName 
   * @param {number} buttonId 
   * @param {boolean} isPressed 
   */
  setButton(sourceName, buttonId, isPressed) {
    if (buttonId < 0 || buttonId > 9) return;

    const sourceSet = this.sources[sourceName];
    if (!sourceSet) return;

    if (isPressed) {
      sourceSet.add(buttonId);
    } else {
      sourceSet.delete(buttonId);
    }

    this._syncButton(buttonId);
  }

  /**
   * Define múltiplos botões de uma fonte (útil para Gamepad e D-pad touch)
   * @param {'keyboard' | 'touch' | 'gamepad'} sourceName 
   * @param {Set<number> | Array<number>} activeButtons 
   */
  setButtonsForSource(sourceName, activeButtons) {
    const sourceSet = this.sources[sourceName];
    if (!sourceSet) return;

    const newSet = new Set(activeButtons);
    // Identifica quais botões mudaram para sincronizar apenas eles
    for (let i = 0; i < 10; i++) {
      const wasInSource = sourceSet.has(i);
      const isInNew = newSet.has(i);
      if (wasInSource !== isInNew) {
        if (isInNew) {
          sourceSet.add(i);
        } else {
          sourceSet.delete(i);
        }
        this._syncButton(i);
      }
    }
  }

  /**
   * Sincroniza o estado unificado do botão com o emulador
   */
  _syncButton(buttonId) {
    if (!this.isEnabled) return;

    // O botão está pressionado se estiver ativo em QUALQUER fonte
    const isNowPressed =
      this.sources.keyboard.has(buttonId) ||
      this.sources.touch.has(buttonId) ||
      this.sources.gamepad.has(buttonId);

    const prevPressed = this.unifiedState[buttonId] === 1;

    if (isNowPressed !== prevPressed) {
      this.unifiedState[buttonId] = isNowPressed ? 1 : 0;
      this.adapter.setButtonState(buttonId, isNowPressed);
    }
  }

  /**
   * Libera todas as entradas de uma fonte específica
   */
  releaseSource(sourceName) {
    const sourceSet = this.sources[sourceName];
    if (sourceSet && sourceSet.size > 0) {
      const affected = Array.from(sourceSet);
      sourceSet.clear();
      for (const btn of affected) {
        this._syncButton(btn);
      }
    }
  }

  /**
   * Libera absolutamente todas as entradas em todas as fontes
   */
  releaseAll() {
    this.sources.keyboard.clear();
    this.sources.touch.clear();
    this.sources.gamepad.clear();

    for (let i = 0; i < 10; i++) {
      if (this.unifiedState[i] === 1) {
        this.unifiedState[i] = 0;
        this.adapter.setButtonState(i, false);
      }
    }
  }

  /**
   * Listeners de teclado
   */
  _initKeyboardListeners() {
    const handleKey = (e, isDown) => {
      // Ignora eventos se o usuário estiver digitando em um input ou textarea
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || e.target?.isContentEditable) {
        return;
      }

      const buttonId = this.keyToGbaMap.get(e.code);
      if (buttonId !== undefined) {
        // Previne scroll da página em teclas de seta, espaço, etc.
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        this.setButton('keyboard', buttonId, isDown);
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => handleKey(e, false), { passive: false });
  }

  /**
   * Libera entradas quando a página perde o foco
   */
  _initFocusListeners() {
    window.addEventListener('blur', () => {
      this.releaseAll();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.releaseAll();
      }
    });
  }
}
