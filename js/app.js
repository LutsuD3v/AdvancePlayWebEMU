/**
 * app.js
 * Ponto de entrada e orquestrador principal do emulador AdvancePlay GBA.
 * Integra todos os módulos: EmulatorAdapter, RomManager, SaveManager, SettingsManager,
 * InputManager, TouchControls, GamepadManager e UIManager.
 */

import { EmulatorAdapter } from './EmulatorAdapter.js';
import { RomManager } from './RomManager.js';
import { SaveManager } from './SaveManager.js';
import { SettingsManager } from './SettingsManager.js';
import { InputManager } from './InputManager.js';
import { TouchControls } from './TouchControls.js';
import { GamepadManager } from './GamepadManager.js';
import { UIManager } from './UIManager.js';

class AdvancePlayApp {
  constructor() {
    this.adapter = new EmulatorAdapter();
    this.romManager = new RomManager();
    this.saveManager = new SaveManager();
    this.settings = new SettingsManager();

    this.inputManager = null;
    this.touchControls = null;
    this.gamepadManager = null;
    this.ui = null;

    this.autoSaveInterval = null;
    this.pendingRecentItem = null;
  }

  async init() {
    try {
      // 1. Inicializa IndexedDB
      await this.saveManager.init();

      // 2. Conecta ao Canvas da tela
      const canvas = document.getElementById('screenCanvas');
      await this.adapter.init(canvas);

      // 3. Inicializa Gerenciador de Entradas Unificado
      this.inputManager = new InputManager(this.adapter, this.settings);

      // 4. Inicializa Controles de Toque na tela
      const touchContainer = document.getElementById('touchControlsContainer');
      if (touchContainer) {
        this.touchControls = new TouchControls(touchContainer, this.inputManager, this.settings);
      }

      // 5. Inicializa Gamepad API
      this.gamepadManager = new GamepadManager(this.inputManager);
      this.gamepadManager.start();

      // 6. Inicializa Gerenciador de Interface
      this.ui = new UIManager(this);

      // Conecta badge de gamepad
      this.gamepadManager.onGamepadStatusChange = (connected, id) => {
        this.ui.updateGamepadStatus(connected, this.gamepadManager.getDeviceName());
      };

      // Listener de erros do núcleo
      this.adapter.onError = (errMsg) => {
        this.ui.showToast(`Aviso do emulador: ${errMsg}`);
      };

      // 7. Mostra tela inicial
      this.ui.showHomeScreen();

      // Proteção de saída acidental quando estiver jogando
      window.addEventListener('beforeunload', (e) => {
        if (this.adapter.state === 'running' || this.adapter.state === 'paused') {
          this.flushAndPersistSave();
          e.preventDefault();
          e.returnValue = '';
        }
      });

      console.log('AdvancePlay GBA Inicializado com sucesso.');
    } catch (err) {
      console.error('Falha crítica na inicialização do AdvancePlay:', err);
      const appContainer = document.getElementById('app');
      if (appContainer) {
        const errDiv = document.createElement('div');
        errDiv.className = 'init-error-alert';
        errDiv.textContent = `Erro ao carregar o núcleo GBA.js: ${err.message}. Verifique os arquivos do navegador.`;
        appContainer.prepend(errDiv);
      }
    }
  }

  /**
   * Carrega uma ROM selecionada pelo usuário
   * @param {File} file 
   */
  async loadRomFromFile(file) {
    try {
      this.ui.showLoading(`Carregando "${file.name}"...`);

      // 1. Lê e valida o arquivo localmente
      const romData = await this.romManager.loadFromFile(file);

      // 2. Carrega no núcleo GBA.js
      const info = this.adapter.loadRom(romData.buffer, romData.name);

      // 3. Carrega save prévio do IndexedDB se existir para este hash de ROM
      const existingSave = await this.saveManager.load(romData.hash);
      if (existingSave) {
        this.adapter.loadSaveData(existingSave);
        this.ui.showToast(`Progresso anterior carregado para ${info.title}!`);
      }

      // 4. Registra no histórico de jogos recentes
      this.saveManager.updateRecentGame({
        romId: romData.hash,
        title: info.title,
        code: info.code,
        fileName: file.name,
        lastPlayed: Date.now(),
        hasSave: !!existingSave
      });

      // 5. Ativa controles e interface do emulador
      this.inputManager.setEnabled(true);
      this.ui.showEmulatorScreen(info);

      // 6. Inicia o loop de emulação
      this.adapter.start();

      // 7. Inicia rotina de salvamento periódico seguro
      this._startAutoSaveRoutine(romData.hash, info.title, info.code);
    } catch (err) {
      this.ui.hideLoading();
      this.ui.showToast(`Erro ao abrir ROM: ${err.message}`);
      console.error('Erro ao abrir ROM:', err);
    }
  }

  /**
   * Carrega a ROM de demonstração em código aberto
   */
  loadDemoRom() {
    try {
      this.ui.showLoading('Iniciando demonstração AdvancePlay...');

      const demoBuffer = this.romManager.createDemoRom();
      const demoHash = 'advanceplay_builtin_demo_v1';
      this.romManager.currentRomHash = demoHash;

      const info = this.adapter.loadRom(demoBuffer, 'AdvancePlay_Demo.gba');

      this.inputManager.setEnabled(true);
      this.ui.showEmulatorScreen(info);
      this.adapter.start();

      this.ui.showToast('Demonstração iniciada! Você pode testar os controles e vídeo.');
    } catch (err) {
      this.ui.hideLoading();
      this.ui.showToast(`Erro ao iniciar demo: ${err.message}`);
    }
  }

  /**
   * Solicita ao usuário a seleção da ROM para um item recente
   */
  requestRomForRecentGame(item) {
    this.pendingRecentItem = item;
    this.ui.showToast(`Selecione o arquivo "${item.fileName}" do seu dispositivo.`);
    this.ui.romFileInput?.click();
  }

  /**
   * Alterna pausa/execução
   */
  togglePause() {
    this.adapter.togglePause();
    const isPaused = this.adapter.state === 'paused';
    this.ui.setPausedState(isPaused);
    this.ui.showToast(isPaused ? 'Emulação pausada' : 'Emulação retomada');
  }

  /**
   * Reinicia a partida
   */
  resetGame() {
    this.flushAndPersistSave();
    this.adapter.reset();
    this.ui.setPausedState(false);
    this.ui.showToast('Jogo reiniciado');
  }

  /**
   * Sai da partida e retorna à tela inicial
   */
  exitToHome() {
    this.flushAndPersistSave();
    this._stopAutoSaveRoutine();
    this.inputManager?.releaseAll();
    this.inputManager?.setEnabled(false);
    this.adapter.unload();
    this.ui.showHomeScreen();
    this.ui.showToast('Sessão encerrada com segurança');
  }

  /**
   * Captura screenshot e dispara download da imagem
   */
  captureScreenshot() {
    const dataUrl = this.adapter.takeScreenshot();
    if (!dataUrl) {
      this.ui.showToast('Não foi possível capturar a tela.');
      return;
    }

    const title = this.adapter.romInfo?.title || 'gba_game';
    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${cleanTitle}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.ui.showToast('Screenshot capturada!');
  }

  /**
   * Grava imediatamente qualquer save pendente no IndexedDB
   */
  async flushAndPersistSave() {
    if (!this.adapter?.hasRom?.() || !this.romManager?.currentRomHash) return;

    this.adapter.flushSave();
    const saveBuffer = this.adapter.getSaveData();
    if (saveBuffer) {
      const romInfo = this.adapter.romInfo;
      await this.saveManager.save(
        this.romManager.currentRomHash,
        romInfo?.title,
        romInfo?.code,
        saveBuffer
      );
    }
  }

  /**
   * Inicia rotina de verificação periódica de save (a cada 5 segundos)
   */
  _startAutoSaveRoutine(romHash, title, code) {
    this._stopAutoSaveRoutine();

    this.autoSaveInterval = setInterval(async () => {
      if (this.adapter.state !== 'running') return;

      if (this.adapter.saveNeedsFlush()) {
        this.adapter.flushSave();
        const saveBuffer = this.adapter.getSaveData();
        if (saveBuffer) {
          await this.saveManager.save(romHash, title, code, saveBuffer);
          console.log('[AutoSave] Progresso sincronizado no IndexedDB.');
        }
      }
    }, 4000);
  }

  _stopAutoSaveRoutine() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}

// Inicializa a aplicação após o carregamento do DOM
window.addEventListener('DOMContentLoaded', () => {
  const app = new AdvancePlayApp();
  window.__advancePlayApp = app;
  app.init();
});
