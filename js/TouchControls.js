/**
 * TouchControls.js
 * Gerenciador dos controles virtuais de toque para celulares e tablets.
 * Suporta multi-toque simultâneo, direcionais com diagonais analógicas/digitais,
 * botões A, B, L, R, Start e Select com resposta tátil e liberação à prova de falhas.
 */

export class TouchControls {
  /**
   * @param {HTMLElement} containerElement 
   * @param {import('./InputManager.js').InputManager} inputManager 
   * @param {import('./SettingsManager.js').SettingsManager} settingsManager 
   */
  constructor(containerElement, inputManager, settingsManager) {
    this.container = containerElement;
    this.input = inputManager;
    this.settings = settingsManager;

    // Rastreamento de ponteiros ativos no D-Pad: pointerId -> Set of buttonIds
    this.dpadPointers = new Map();

    // Rastreamento de botões de ação: pointerId -> buttonId
    this.actionPointers = new Map();

    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    this._setupElements();
    this._attachEventListeners();
    this.applySettings();

    this.settings.subscribe(() => {
      this.applySettings();
    });
  }

  /**
   * Constrói o HTML dos controles de toque
   */
  _setupElements() {
    this.container.innerHTML = `
      <div class="touch-controls-wrapper" id="touchControlsWrapper">
        <!-- Gatilhos superiores L e R -->
        <div class="touch-shoulders-row">
          <button type="button" class="touch-btn touch-btn-shoulder" data-btn="L" id="btnTouchL" aria-label="Gatilho L">
            <span>L</span>
          </button>
          <button type="button" class="touch-btn touch-btn-shoulder" data-btn="R" id="btnTouchR" aria-label="Gatilho R">
            <span>R</span>
          </button>
        </div>

        <!-- Área principal inferior: D-pad à esquerda, Start/Select ao centro, A/B à direita -->
        <div class="touch-main-row">
          <!-- Direcional Digital (D-Pad) -->
          <div class="touch-dpad-container" id="touchDpad">
            <div class="touch-dpad-cross">
              <div class="touch-dpad-arm arm-up" data-dir="UP"></div>
              <div class="touch-dpad-arm arm-down" data-dir="DOWN"></div>
              <div class="touch-dpad-arm arm-left" data-dir="LEFT"></div>
              <div class="touch-dpad-arm arm-right" data-dir="RIGHT"></div>
              <div class="touch-dpad-center"></div>
            </div>
            <!-- Zonas de toque invisíveis ampliadas para precisão e diagonais -->
            <div class="touch-dpad-hitbox" data-quadrant="center"></div>
          </div>

          <!-- Botões Centrais: SELECT e START -->
          <div class="touch-system-group">
            <button type="button" class="touch-btn touch-btn-pill" data-btn="SELECT" id="btnTouchSelect" aria-label="Select">
              <span class="pill-label">SELECT</span>
            </button>
            <button type="button" class="touch-btn touch-btn-pill" data-btn="START" id="btnTouchStart" aria-label="Start">
              <span class="pill-label">START</span>
            </button>
          </div>

          <!-- Botões de Ação: B e A (em ângulo ergonômico) -->
          <div class="touch-action-group">
            <button type="button" class="touch-btn touch-btn-round btn-b" data-btn="B" id="btnTouchB" aria-label="Botão B">
              <span>B</span>
            </button>
            <button type="button" class="touch-btn touch-btn-round btn-a" data-btn="A" id="btnTouchA" aria-label="Botão A">
              <span>A</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.wrapper = this.container.querySelector('#touchControlsWrapper');
    this.dpadElement = this.container.querySelector('#touchDpad');
  }

  /**
   * Aplica configurações de tamanho, opacidade e visibilidade
   */
  applySettings() {
    const opts = this.settings.get('touchControls') || {};
    const mode = opts.mode || 'auto';
    const scale = opts.scale || 1.0;
    const opacity = opts.opacity !== undefined ? opts.opacity : 0.75;

    let shouldShow = false;
    if (mode === 'always') {
      shouldShow = true;
    } else if (mode === 'hidden') {
      shouldShow = false;
    } else {
      // 'auto': exibe se for dispositivo de toque ou largura menor que 1024px
      shouldShow = this.isTouchDevice || window.innerWidth <= 1024;
    }

    this.container.style.display = shouldShow ? 'block' : 'none';
    if (this.wrapper) {
      this.wrapper.style.setProperty('--touch-scale', scale);
      this.wrapper.style.setProperty('--touch-opacity', opacity);
    }
  }

  /**
   * Vibração háptica discreta se habilitada
   */
  _vibrate() {
    const opts = this.settings.get('touchControls') || {};
    if (opts.haptic && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch (e) {}
    }
  }

  /**
   * Mapeia nome do botão para o ID numérico do GBA
   */
  _getGbaButtonId(name) {
    const BUTTONS = this.input.adapter.BUTTONS;
    return BUTTONS[name];
  }

  /**
   * Conecta ouvintes de eventos de ponteiro nos controles
   */
  _attachEventListeners() {
    // 1. D-Pad: cálculo de direção por posição relativa do toque
    this._attachDpadListeners();

    // 2. Botões de ação (A, B, L, R, START, SELECT)
    const actionButtons = this.container.querySelectorAll('[data-btn]');
    actionButtons.forEach(btn => {
      this._attachActionButtonListeners(btn);
    });

    // 3. Previne menu de contexto e gestos padrão na área dos controles
    this.container.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });
    this.container.addEventListener('selectstart', (e) => e.preventDefault(), { passive: false });
  }

  /**
   * Listeners do D-Pad usando detecção radial para 8 direções
   */
  _attachDpadListeners() {
    const dpad = this.dpadElement;
    if (!dpad) return;

    const arms = {
      UP: dpad.querySelector('.arm-up'),
      DOWN: dpad.querySelector('.arm-down'),
      LEFT: dpad.querySelector('.arm-left'),
      RIGHT: dpad.querySelector('.arm-right')
    };

    const processDpadPosition = (clientX, clientY, pointerId) => {
      const rect = dpad.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      // Zona morta no centro (15% do raio)
      const minRadius = rect.width * 0.12;
      const maxRadius = rect.width * 0.75; // Permite deslizar ligeiramente fora

      const newDirs = new Set();

      if (distance >= minRadius && distance <= maxRadius) {
        // Ângulo em graus de -180 a 180 (0 = direita, 90 = baixo, -90 = cima, 180 = esquerda)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Direita: -67.5 a 67.5
        if (angle >= -67.5 && angle <= 67.5) {
          newDirs.add(this._getGbaButtonId('RIGHT'));
        }
        // Esquerda: 112.5 a 180 ou -180 a -112.5
        if (angle >= 112.5 || angle <= -112.5) {
          newDirs.add(this._getGbaButtonId('LEFT'));
        }
        // Cima: -157.5 a -22.5
        if (angle >= -157.5 && angle <= -22.5) {
          newDirs.add(this._getGbaButtonId('UP'));
        }
        // Baixo: 22.5 a 157.5
        if (angle >= 22.5 && angle <= 157.5) {
          newDirs.add(this._getGbaButtonId('DOWN'));
        }
      }

      // Atualiza visual dos braços do direcional
      arms.UP?.classList.toggle('active', newDirs.has(this._getGbaButtonId('UP')));
      arms.DOWN?.classList.toggle('active', newDirs.has(this._getGbaButtonId('DOWN')));
      arms.LEFT?.classList.toggle('active', newDirs.has(this._getGbaButtonId('LEFT')));
      arms.RIGHT?.classList.toggle('active', newDirs.has(this._getGbaButtonId('RIGHT')));

      // Registra ponteiro
      this.dpadPointers.set(pointerId, newDirs);
      this._syncTouchInputs();
    };

    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dpad.setPointerCapture(e.pointerId);
      this._vibrate();
      processDpadPosition(e.clientX, e.clientY, e.pointerId);
    }, { passive: false });

    dpad.addEventListener('pointermove', (e) => {
      if (this.dpadPointers.has(e.pointerId)) {
        e.preventDefault();
        processDpadPosition(e.clientX, e.clientY, e.pointerId);
      }
    }, { passive: false });

    const releaseDpadPointer = (pointerId) => {
      this.dpadPointers.delete(pointerId);
      if (this.dpadPointers.size === 0) {
        arms.UP?.classList.remove('active');
        arms.DOWN?.classList.remove('active');
        arms.LEFT?.classList.remove('active');
        arms.RIGHT?.classList.remove('active');
      }
      this._syncTouchInputs();
    };

    dpad.addEventListener('pointerup', (e) => releaseDpadPointer(e.pointerId));
    dpad.addEventListener('pointercancel', (e) => releaseDpadPointer(e.pointerId));
    dpad.addEventListener('lostpointercapture', (e) => releaseDpadPointer(e.pointerId));
  }

  /**
   * Listeners para botões individuais de ação (A, B, L, R, Start, Select)
   */
  _attachActionButtonListeners(btnElement) {
    const btnName = btnElement.getAttribute('data-btn');
    const buttonId = this._getGbaButtonId(btnName);
    if (buttonId === undefined) return;

    btnElement.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btnElement.setPointerCapture(e.pointerId);
      btnElement.classList.add('active');
      this.actionPointers.set(e.pointerId, buttonId);
      this._vibrate();
      this._syncTouchInputs();
    }, { passive: false });

    const releaseButton = (pointerId) => {
      this.actionPointers.delete(pointerId);
      btnElement.classList.remove('active');
      this._syncTouchInputs();
    };

    btnElement.addEventListener('pointerup', (e) => releaseButton(e.pointerId));
    btnElement.addEventListener('pointercancel', (e) => releaseButton(e.pointerId));
    btnElement.addEventListener('lostpointercapture', (e) => releaseButton(e.pointerId));
  }

  /**
   * Sincroniza todos os toques ativos com a fonte 'touch' do InputManager
   */
  _syncTouchInputs() {
    const allActiveButtons = new Set();

    // Adiciona direções ativas do D-pad
    for (const dirSet of this.dpadPointers.values()) {
      for (const btn of dirSet) {
        allActiveButtons.add(btn);
      }
    }

    // Adiciona botões de ação ativos
    for (const btnId of this.actionPointers.values()) {
      allActiveButtons.add(btnId);
    }

    this.input.setButtonsForSource('touch', allActiveButtons);
  }

  /**
   * Libera todos os botões de toque
   */
  releaseAll() {
    this.dpadPointers.clear();
    this.actionPointers.clear();
    const activeElements = this.container.querySelectorAll('.active');
    activeElements.forEach(el => el.classList.remove('active'));
    this.input.releaseSource('touch');
  }
}
