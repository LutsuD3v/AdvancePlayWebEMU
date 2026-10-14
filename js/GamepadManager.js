/**
 * GamepadManager.js
 * Gerenciador de controles físicos externos via Gamepad API do navegador.
 * Suporta controles USB e Bluetooth (Xbox, PlayStation, 8BitDo, Switch Pro e genéricos).
 * Leitura eficiente sincronizada via requestAnimationFrame com tratamento de zona morta analógica.
 */

export class GamepadManager {
  /**
   * @param {import('./InputManager.js').InputManager} inputManager 
   */
  constructor(inputManager) {
    this.input = inputManager;
    this.connectedGamepad = null;
    this.animationFrameId = null;
    this.isRunning = false;

    // Callbacks para atualizar indicador na UI
    this.onGamepadStatusChange = null;

    // Configuração de zona morta analógica para evitar 'drift'
    this.DEADZONE = 0.25;

    // Mapeamento padrão Standard Gamepad para GBA
    // Standard Gamepad:
    // 0: A/Cruz (inferior) -> GBA A
    // 1: B/Círculo (direita) -> GBA B
    // 2: X/Quadrado (esquerda) -> GBA B (alternativo conveniente)
    // 3: Y/Triângulo (superior) -> GBA A (alternativo)
    // 4: L1/LB -> GBA L
    // 5: R1/RB -> GBA R
    // 8: Back/Select/Share -> GBA SELECT
    // 9: Start/Options -> GBA START
    // 12: D-Pad Up -> GBA UP
    // 13: D-Pad Down -> GBA DOWN
    // 14: D-Pad Left -> GBA LEFT
    // 15: D-Pad Right -> GBA RIGHT

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad conectado:', e.gamepad.id);
      this.connectedGamepad = e.gamepad;
      if (this.onGamepadStatusChange) {
        this.onGamepadStatusChange(true, e.gamepad.id);
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('Gamepad desconectado:', e.gamepad.id);
      if (this.connectedGamepad && this.connectedGamepad.index === e.gamepad.index) {
        this.connectedGamepad = null;
        this.input.releaseSource('gamepad');
        if (this.onGamepadStatusChange) {
          this.onGamepadStatusChange(false, null);
        }
      }
    });
  }

  /**
   * Inicia o ciclo de polling contínuo do Gamepad
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = () => {
      if (!this.isRunning) return;
      this._pollGamepad();
      this.animationFrameId = requestAnimationFrame(poll);
    };

    this.animationFrameId = requestAnimationFrame(poll);
  }

  /**
   * Pausa o polling
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.input.releaseSource('gamepad');
  }

  /**
   * Consulta os gamepads ativos do navegador e processa os botões
   */
  _pollGamepad() {
    if (!navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    let activePad = null;

    // Procura o primeiro gamepad válido conectado
    for (let i = 0; i < gamepads.length; i++) {
      const pad = gamepads[i];
      if (pad && pad.connected) {
        activePad = pad;
        break;
      }
    }

    if (!activePad) {
      if (this.connectedGamepad) {
        this.connectedGamepad = null;
        this.input.releaseSource('gamepad');
        if (this.onGamepadStatusChange) {
          this.onGamepadStatusChange(false, null);
        }
      }
      return;
    }

    if (!this.connectedGamepad) {
      this.connectedGamepad = activePad;
      if (this.onGamepadStatusChange) {
        this.onGamepadStatusChange(true, activePad.id);
      }
    }

    // Processa os botões do controle e preenche o conjunto de botões GBA ativos
    const BUTTONS = this.input.adapter.BUTTONS;
    const activeButtons = new Set();
    const buttons = activePad.buttons;

    const isPressed = (index) => {
      if (!buttons[index]) return false;
      return typeof buttons[index] === 'object' ? buttons[index].pressed : buttons[index] > 0.5;
    };

    // A e B do GBA
    // Padrão comum: botão inferior (0) = A, botão esquerdo (2) = B (ou 1 = B no layout Nintendo)
    if (isPressed(0) || isPressed(3)) {
      activeButtons.add(BUTTONS.A);
    }
    if (isPressed(1) || isPressed(2)) {
      activeButtons.add(BUTTONS.B);
    }

    // Gatilhos L e R
    if (isPressed(4) || isPressed(6)) { // L1 ou L2
      activeButtons.add(BUTTONS.L);
    }
    if (isPressed(5) || isPressed(7)) { // R1 ou R2
      activeButtons.add(BUTTONS.R);
    }

    // START e SELECT
    if (isPressed(9)) {
      activeButtons.add(BUTTONS.START);
    }
    if (isPressed(8)) {
      activeButtons.add(BUTTONS.SELECT);
    }

    // D-Pad digital padrão
    if (isPressed(12)) activeButtons.add(BUTTONS.UP);
    if (isPressed(13)) activeButtons.add(BUTTONS.DOWN);
    if (isPressed(14)) activeButtons.add(BUTTONS.LEFT);
    if (isPressed(15)) activeButtons.add(BUTTONS.RIGHT);

    // Alavanca analógica esquerda (Axes 0 e 1) como alternativa suave ao direcional
    if (activePad.axes && activePad.axes.length >= 2) {
      const axisX = activePad.axes[0];
      const axisY = activePad.axes[1];

      if (axisX < -this.DEADZONE) activeButtons.add(BUTTONS.LEFT);
      if (axisX > this.DEADZONE) activeButtons.add(BUTTONS.RIGHT);
      if (axisY < -this.DEADZONE) activeButtons.add(BUTTONS.UP);
      if (axisY > this.DEADZONE) activeButtons.add(BUTTONS.DOWN);
    }

    // Envia o conjunto de botões ativos para o InputManager
    this.input.setButtonsForSource('gamepad', activeButtons);
  }

  /**
   * Retorna o nome formatado do controle conectado atualmente
   */
  getDeviceName() {
    if (!this.connectedGamepad) return null;
    const rawId = this.connectedGamepad.id || 'Controle';
    // Remove identificadores excessivos de fornecedor para um rótulo limpo
    return rawId.replace(/\(.*?\)/g, '').trim() || 'Controle USB/Bluetooth';
  }
}
