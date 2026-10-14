/**
 * UIManager.js
 * Gerenciador da interface visual, alternância de telas (Home / Emulador),
 * modais de configurações, gerenciamento de saves, feedback de controles e notificações.
 */

export class UIManager {
  constructor(app) {
    this.app = app;
    this.activeModal = null;
    this.keyRemapTarget = null;
    this.toastTimer = null;

    this._cacheDomElements();
    this._bindEvents();
  }

  _cacheDomElements() {
    // Telas
    this.homeScreen = document.getElementById('homeScreen');
    this.emulatorScreen = document.getElementById('emulatorScreen');

    // Elementos da tela inicial
    this.btnOpenRom = document.getElementById('btnOpenRom');
    this.romFileInput = document.getElementById('romFileInput');
    this.dropZone = document.getElementById('dropZone');
    this.btnDemoRom = document.getElementById('btnDemoRom');
    this.recentGamesSection = document.getElementById('recentGamesSection');
    this.recentGamesList = document.getElementById('recentGamesList');
    this.btnHomeSettings = document.getElementById('btnHomeSettings');
    this.btnHomeAbout = document.getElementById('btnHomeAbout');

    // Elementos da tela do emulador
    this.screenCanvas = document.getElementById('screenCanvas');
    this.videoContainer = document.getElementById('videoContainer');
    this.gameTitleDisplay = document.getElementById('gameTitleDisplay');
    this.gameCodeBadge = document.getElementById('gameCodeBadge');
    this.gamepadStatusBadge = document.getElementById('gamepadStatusBadge');
    this.fpsCounter = document.getElementById('fpsCounter');

    // Botões de ação da barra de ferramentas do emulador
    this.btnPause = document.getElementById('btnPause');
    this.btnReset = document.getElementById('btnReset');
    this.btnMute = document.getElementById('btnMute');
    this.btnVolume = document.getElementById('btnVolume');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.volumePopover = document.getElementById('volumePopover');
    this.btnSaveMenu = document.getElementById('btnSaveMenu');
    this.btnScreenshot = document.getElementById('btnScreenshot');
    this.btnFullscreen = document.getElementById('btnFullscreen');
    this.btnSettings = document.getElementById('btnSettings');
    this.btnExitToHome = document.getElementById('btnExitToHome');

    // Overlays
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.btnResumeOverlay = document.getElementById('btnResumeOverlay');

    // Modais
    this.modalOverlay = document.getElementById('modalOverlay');
    this.settingsModal = document.getElementById('settingsModal');
    this.saveModal = document.getElementById('saveModal');
    this.confirmModal = document.getElementById('confirmModal');
    this.aboutModal = document.getElementById('aboutModal');

    // Toasts
    this.toast = document.getElementById('toastNotification');
    this.toastMessage = document.getElementById('toastMessage');

    // Controles de toque
    this.touchContainer = document.getElementById('touchControlsContainer');
  }

  _bindEvents() {
    // 1. Abertura de ROM na tela inicial
    this.btnOpenRom?.addEventListener('click', () => {
      this.romFileInput?.click();
    });

    this.romFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.app.loadRomFromFile(file);
      }
      e.target.value = '';
    });

    // 2. Drag & Drop na DropZone e na janela
    this._setupDragAndDrop();

    // 3. Botão de ROM de demonstração
    this.btnDemoRom?.addEventListener('click', () => {
      this.app.loadDemoRom();
    });

    // 4. Botões de reprodução do emulador
    this.btnPause?.addEventListener('click', () => this.app.togglePause());
    this.btnResumeOverlay?.addEventListener('click', () => this.app.togglePause());

    this.btnReset?.addEventListener('click', () => {
      this.showConfirm(
        'Reiniciar partida?',
        'Qualquer progresso não salvo no cartucho será perdido.',
        'Reiniciar',
        () => this.app.resetGame()
      );
    });

    this.btnExitToHome?.addEventListener('click', () => {
      this.showConfirm(
        'Retornar à tela inicial?',
        'A sessão atual do emulador será encerrada. Certifique-se de ter salvo seu progresso.',
        'Sair do Jogo',
        () => this.app.exitToHome()
      );
    });

    // 5. Áudio
    this.btnMute?.addEventListener('click', () => {
      const isMuted = !this.app.settings.get('muted');
      this.app.settings.set('muted', isMuted);
      this.app.adapter.setMute(isMuted);
      this.updateAudioIcons(isMuted, this.app.settings.get('volume'));
      this.showToast(isMuted ? 'Áudio silenciado' : 'Áudio ativado');
    });

    this.volumeSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.app.settings.set('volume', val);
      if (this.app.settings.get('muted') && val > 0) {
        this.app.settings.set('muted', false);
        this.app.adapter.setMute(false);
      }
      this.app.adapter.setVolume(val);
      this.updateAudioIcons(this.app.settings.get('muted'), val);
    });

    // Toggle popover de volume
    this.btnVolume?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.volumePopover?.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!this.volumePopover?.contains(e.target) && e.target !== this.btnVolume) {
        this.volumePopover?.classList.remove('open');
      }
    });

    // 6. Screenshot
    this.btnScreenshot?.addEventListener('click', () => {
      this.app.captureScreenshot();
    });

    // 7. Fullscreen
    this.btnFullscreen?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 8. Modais
    this.btnSettings?.addEventListener('click', () => this.openSettingsModal());
    this.btnHomeSettings?.addEventListener('click', () => this.openSettingsModal());
    this.btnHomeAbout?.addEventListener('click', () => this.openAboutModal());
    this.btnSaveMenu?.addEventListener('click', () => this.openSaveModal());

    // Fechar modais ao clicar no overlay ou botões de fechar
    this.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeAllModals();
      }
    });

    document.querySelectorAll('.btn-modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // 9. Abas do modal de configurações
    this._setupSettingsTabs();

    // 10. Atualização de FPS
    this.app.adapter.onFpsUpdate = (fps) => {
      if (this.fpsCounter) {
        this.fpsCounter.textContent = `${fps} FPS`;
      }
    };
  }

  _setupDragAndDrop() {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone?.classList.add('drag-active');
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone?.classList.remove('drag-active');
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone?.classList.remove('drag-active');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.app.loadRomFromFile(files[0]);
      }
    };

    ['dragenter', 'dragover'].forEach(name => {
      window.addEventListener(name, (e) => {
        if (this.homeScreen.style.display !== 'none') {
          handleDragOver(e);
        }
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      window.addEventListener(name, (e) => {
        if (this.homeScreen.style.display !== 'none') {
          if (name === 'drop') handleDrop(e);
          else handleDragLeave(e);
        }
      });
    });
  }

  /**
   * Alterna para a tela inicial
   */
  showHomeScreen() {
    this.homeScreen.style.display = 'block';
    this.emulatorScreen.style.display = 'none';
    this.renderRecentGames();
    this.closeAllModals();
  }

  /**
   * Alterna para a tela do emulador
   */
  showEmulatorScreen(romInfo) {
    this.homeScreen.style.display = 'none';
    this.emulatorScreen.style.display = 'flex';

    if (this.gameTitleDisplay) {
      this.gameTitleDisplay.textContent = romInfo.title;
    }
    if (this.gameCodeBadge) {
      this.gameCodeBadge.textContent = romInfo.code;
    }

    this.applyVideoFilter(this.app.settings.get('filter'));
    this.applyDisplayMode(this.app.settings.get('displayMode'));
    this.updateAudioIcons(this.app.settings.get('muted'), this.app.settings.get('volume'));

    this.setPausedState(false);
    this.hideLoading();
  }

  /**
   * Exibe overlay de carregamento
   */
  showLoading(text = 'Carregando ROM...') {
    if (this.loadingOverlay) {
      const label = this.loadingOverlay.querySelector('.loading-text');
      if (label) label.textContent = text;
      this.loadingOverlay.style.display = 'flex';
    }
  }

  /**
   * Oculta overlay de carregamento
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'none';
    }
  }

  /**
   * Atualiza interface de pausa
   */
  setPausedState(isPaused) {
    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = isPaused ? 'flex' : 'none';
    }
    if (this.btnPause) {
      this.btnPause.setAttribute('aria-label', isPaused ? 'Continuar jogo' : 'Pausar jogo');
      this.btnPause.innerHTML = isPaused ? this.getPlayIconSvg() : this.getPauseIconSvg();
    }
  }

  /**
   * Atualiza ícones de áudio
   */
  updateAudioIcons(isMuted, volume) {
    if (this.btnMute) {
      this.btnMute.innerHTML = isMuted || volume === 0 ? this.getMuteIconSvg() : this.getVolumeIconSvg();
    }
    if (this.volumeSlider) {
      this.volumeSlider.value = isMuted ? 0 : volume;
    }
  }

  /**
   * Aplica o filtro de renderização de vídeo
   */
  applyVideoFilter(filterName) {
    if (!this.screenCanvas) return;
    this.screenCanvas.classList.remove('filter-pixelated', 'filter-smooth', 'filter-scanlines');
    this.videoContainer?.classList.remove('has-scanlines');

    if (filterName === 'smooth') {
      this.screenCanvas.classList.add('filter-smooth');
    } else if (filterName === 'scanlines') {
      this.screenCanvas.classList.add('filter-pixelated');
      this.videoContainer?.classList.add('has-scanlines');
    } else {
      this.screenCanvas.classList.add('filter-pixelated');
    }
  }

  /**
   * Aplica o modo de escala de vídeo
   */
  applyDisplayMode(mode) {
    if (!this.screenCanvas) return;
    this.screenCanvas.classList.remove('scale-1x', 'scale-2x', 'scale-3x', 'scale-contain');
    this.screenCanvas.classList.add(`scale-${mode || 'contain'}`);
  }

  /**
   * Atualiza badge de status de Gamepad
   */
  updateGamepadStatus(isConnected, deviceName) {
    if (!this.gamepadStatusBadge) return;
    if (isConnected) {
      this.gamepadStatusBadge.style.display = 'inline-flex';
      this.gamepadStatusBadge.title = deviceName || 'Controle Conectado';
      this.showToast(`Controle conectado: ${deviceName || 'Gamepad'}`);
    } else {
      this.gamepadStatusBadge.style.display = 'none';
    }
  }

  /**
   * Renderiza a lista de jogos recentes na tela inicial
   */
  renderRecentGames() {
    if (!this.recentGamesList || !this.recentGamesSection) return;

    const recents = this.app.saveManager.getRecentGames();
    if (recents.length === 0) {
      this.recentGamesSection.style.display = 'none';
      return;
    }

    this.recentGamesSection.style.display = 'block';
    this.recentGamesList.innerHTML = '';

    recents.forEach(item => {
      const card = document.createElement('div');
      card.className = 'recent-game-card';

      const dateStr = new Date(item.lastPlayed).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="recent-game-info">
          <div class="recent-game-title">${this.escapeHtml(item.title)}</div>
          <div class="recent-game-meta">
            <span class="game-code">${this.escapeHtml(item.code)}</span>
            <span class="meta-separator">·</span>
            <span class="recent-date">${dateStr}</span>
            ${item.hasSave ? '<span class="meta-separator">·</span><span class="save-indicator">Save local</span>' : ''}
          </div>
        </div>
        <div class="recent-game-actions">
          <button type="button" class="btn-recent-play" title="Jogar novamente" aria-label="Jogar novamente ${this.escapeHtml(item.title)}">
            ${this.getPlayIconSvg()}
            <span>Abrir</span>
          </button>
          <button type="button" class="btn-recent-remove" title="Remover do histórico" aria-label="Remover ${this.escapeHtml(item.title)} do histórico">
            ${this.getTrashIconSvg()}
          </button>
        </div>
      `;

      // Ação de jogar novamente (solicita o arquivo de ROM caso não esteja em memória)
      card.querySelector('.btn-recent-play')?.addEventListener('click', () => {
        this.app.requestRomForRecentGame(item);
      });

      // Ação de remover do histórico
      card.querySelector('.btn-recent-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.saveManager.removeRecentGame(item.romId);
        this.renderRecentGames();
        this.showToast('Jogo removido do histórico');
      });

      this.recentGamesList.appendChild(card);
    });
  }

  /**
   * Abre modal de configurações
   */
  openSettingsModal() {
    this.closeAllModals();
    this._populateSettingsForm();
    this.modalOverlay.style.display = 'flex';
    this.settingsModal.style.display = 'block';
    this.activeModal = this.settingsModal;
  }

  /**
   * Abre modal de gerenciamento de savegames
   */
  async openSaveModal() {
    this.closeAllModals();
    const saveStatusText = document.getElementById('saveModalStatus');
    const btnDownloadSave = document.getElementById('btnDownloadSave');
    const btnUploadSave = document.getElementById('btnUploadSave');
    const saveFileInput = document.getElementById('saveFileInput');
    const btnDeleteLocalSave = document.getElementById('btnDeleteLocalSave');

    const romInfo = this.app.adapter.romInfo;
    const hasData = this.app.adapter.getSaveData() !== null;

    if (saveStatusText) {
      if (hasData) {
        saveStatusText.textContent = `Dados de cartucho disponíveis para "${romInfo?.title || 'este jogo'}". Você pode exportar seu arquivo .sav ou carregar um save externo.`;
      } else {
        saveStatusText.textContent = 'O jogo ainda não gravou dados de progresso no cartucho nesta sessão.';
      }
    }

    if (btnDownloadSave) {
      btnDownloadSave.onclick = () => {
        const sdata = this.app.adapter.getSaveData();
        if (sdata) {
          const fn = this.app.saveManager.exportSaveFile(romInfo?.title, romInfo?.code, sdata);
          this.showToast(`Arquivo "${fn}" exportado com sucesso!`);
        } else {
          this.showToast('Nenhum dado de save gerado ainda.');
        }
      };
    }

    if (btnUploadSave && saveFileInput) {
      btnUploadSave.onclick = () => saveFileInput.click();

      saveFileInput.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          try {
            const buf = await this.app.saveManager.importSaveFile(file);
            this.app.adapter.loadSaveData(buf);
            this.showToast('Save importado com sucesso! Reinicie o jogo se necessário.');
            this.closeAllModals();
          } catch (err) {
            this.showToast(err.message);
          }
        }
        e.target.value = '';
      };
    }

    if (btnDeleteLocalSave) {
      btnDeleteLocalSave.onclick = async () => {
        if (this.app.romManager.currentRomHash) {
          this.showConfirm(
            'Apagar save local?',
            'Os dados gravados para esta ROM serão removidos do IndexedDB.',
            'Apagar',
            async () => {
              await this.app.saveManager.deleteSave(this.app.romManager.currentRomHash);
              this.showToast('Save local removido.');
              this.closeAllModals();
            }
          );
        }
      };
    }

    this.modalOverlay.style.display = 'flex';
    this.saveModal.style.display = 'block';
    this.activeModal = this.saveModal;
  }

  /**
   * Abre modal Sobre / Créditos
   */
  openAboutModal() {
    this.closeAllModals();
    this.modalOverlay.style.display = 'flex';
    this.aboutModal.style.display = 'block';
    this.activeModal = this.aboutModal;
  }

  /**
   * Exibe modal genérico de confirmação
   */
  showConfirm(title, message, confirmBtnLabel, onConfirm) {
    this.closeAllModals();
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnConfirmCancel');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (btnConfirm) {
      btnConfirm.textContent = confirmBtnLabel || 'Confirmar';
      btnConfirm.onclick = () => {
        this.closeAllModals();
        if (onConfirm) onConfirm();
      };
    }
    if (btnCancel) {
      btnCancel.onclick = () => this.closeAllModals();
    }

    this.modalOverlay.style.display = 'flex';
    this.confirmModal.style.display = 'block';
    this.activeModal = this.confirmModal;
  }

  /**
   * Fecha todos os modais abertos
   */
  closeAllModals() {
    if (this.modalOverlay) this.modalOverlay.style.display = 'none';
    if (this.settingsModal) this.settingsModal.style.display = 'none';
    if (this.saveModal) this.saveModal.style.display = 'none';
    if (this.confirmModal) this.confirmModal.style.display = 'none';
    if (this.aboutModal) this.aboutModal.style.display = 'none';
    this.activeModal = null;
    this.keyRemapTarget = null;
  }

  /**
   * Configura abas dentro do modal de configurações
   */
  _setupSettingsTabs() {
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanes = document.querySelectorAll('.settings-tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  }

  /**
   * Preenche o formulário de configurações com os valores atuais
   */
  _populateSettingsForm() {
    const settings = this.app.settings;

    // Vídeo
    const filterSelect = document.getElementById('settingFilter');
    if (filterSelect) {
      filterSelect.value = settings.get('filter');
      filterSelect.onchange = (e) => {
        settings.set('filter', e.target.value);
        this.applyVideoFilter(e.target.value);
      };
    }

    const displaySelect = document.getElementById('settingDisplayMode');
    if (displaySelect) {
      displaySelect.value = settings.get('displayMode');
      displaySelect.onchange = (e) => {
        settings.set('displayMode', e.target.value);
        this.applyDisplayMode(e.target.value);
      };
    }

    // FPS
    const fpsCheck = document.getElementById('settingShowFps');
    if (fpsCheck) {
      fpsCheck.checked = settings.get('showFps');
      if (this.fpsCounter) {
        this.fpsCounter.style.display = fpsCheck.checked ? 'block' : 'none';
      }
      fpsCheck.onchange = (e) => {
        settings.set('showFps', e.target.checked);
        if (this.fpsCounter) {
          this.fpsCounter.style.display = e.target.checked ? 'block' : 'none';
        }
      };
    }

    // Toque
    const touchOpts = settings.get('touchControls') || {};
    const touchMode = document.getElementById('settingTouchMode');
    if (touchMode) {
      touchMode.value = touchOpts.mode || 'auto';
      touchMode.onchange = (e) => {
        settings.setTouchOption('mode', e.target.value);
        this.app.touchControls?.applySettings();
      };
    }

    const touchScale = document.getElementById('settingTouchScale');
    if (touchScale) {
      touchScale.value = String(touchOpts.scale || 1.0);
      touchScale.onchange = (e) => {
        settings.setTouchOption('scale', parseFloat(e.target.value));
        this.app.touchControls?.applySettings();
      };
    }

    const touchOpacity = document.getElementById('settingTouchOpacity');
    if (touchOpacity) {
      touchOpacity.value = String(touchOpts.opacity !== undefined ? touchOpts.opacity : 0.75);
      touchOpacity.oninput = (e) => {
        settings.setTouchOption('opacity', parseFloat(e.target.value));
        this.app.touchControls?.applySettings();
      };
    }

    const touchHaptic = document.getElementById('settingTouchHaptic');
    if (touchHaptic) {
      touchHaptic.checked = !!touchOpts.haptic;
      touchHaptic.onchange = (e) => {
        settings.setTouchOption('haptic', e.target.checked);
      };
    }

    // Teclas de controle
    this._renderKeymapList();

    // Botão resetar configurações
    const btnResetSettings = document.getElementById('btnResetSettings');
    if (btnResetSettings) {
      btnResetSettings.onclick = () => {
        this.showConfirm(
          'Restaurar configurações?',
          'Todas as preferências de teclas, vídeo e toque voltarão aos valores padrão.',
          'Restaurar',
          () => {
            settings.resetToDefaults();
            this.applyVideoFilter(settings.get('filter'));
            this.applyDisplayMode(settings.get('displayMode'));
            this.app.touchControls?.applySettings();
            this.openSettingsModal();
            this.showToast('Configurações restauradas.');
          }
        );
      };
    }
  }

  /**
   * Renderiza tabela de remapeamento de teclado
   */
  _renderKeymapList() {
    const listEl = document.getElementById('keymapList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const keymap = this.app.settings.get('keymap') || {};
    const labels = {
      UP: 'D-Pad Cima',
      DOWN: 'D-Pad Baixo',
      LEFT: 'D-Pad Esquerda',
      RIGHT: 'D-Pad Direita',
      A: 'Botão A',
      B: 'Botão B',
      L: 'Gatilho L',
      R: 'Gatilho R',
      START: 'Botão START',
      SELECT: 'Botão SELECT'
    };

    for (const [btnKey, label] of Object.entries(labels)) {
      const row = document.createElement('div');
      row.className = 'keymap-row';

      const keyText = this._formatKeyCode(keymap[btnKey]);

      row.innerHTML = `
        <span class="keymap-label">${label}</span>
        <button type="button" class="btn-remap-key" data-btn="${btnKey}">
          <kbd>${keyText}</kbd>
        </button>
      `;

      const remapBtn = row.querySelector('.btn-remap-key');
      remapBtn?.addEventListener('click', () => {
        this._startRemapKey(btnKey, remapBtn);
      });

      listEl.appendChild(row);
    }
  }

  _formatKeyCode(code) {
    if (!code) return 'Não definida';
    if (code.startsWith('Key')) return code.substring(3);
    if (code.startsWith('Arrow')) return code.replace('Arrow', 'Seta ');
    if (code.startsWith('Digit')) return code.substring(5);
    if (code === 'Enter') return 'Enter';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'Backspace') return 'Backspace';
    if (code === 'Space') return 'Espaço';
    return code;
  }

  _startRemapKey(btnKey, buttonElement) {
    const prevText = buttonElement.innerHTML;
    buttonElement.innerHTML = '<span class="remap-active">Pressione uma tecla...</span>';
    buttonElement.classList.add('listening');

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        buttonElement.innerHTML = prevText;
        buttonElement.classList.remove('listening');
        window.removeEventListener('keydown', handleKeyDown, true);
        return;
      }

      this.app.settings.setKeyBinding(btnKey, e.code);
      buttonElement.innerHTML = `<kbd>${this._formatKeyCode(e.code)}</kbd>`;
      buttonElement.classList.remove('listening');
      window.removeEventListener('keydown', handleKeyDown, true);
      this.showToast(`Tecla "${this._formatKeyCode(e.code)}" vinculada.`);
    };

    window.addEventListener('keydown', handleKeyDown, true);
  }

  /**
   * Alterna modo tela cheia
   */
  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (this.emulatorScreen?.requestFullscreen) {
          await this.emulatorScreen.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Erro ao alternar fullscreen:', e);
    }
  }

  /**
   * Notificação Toast flutuante discreta
   */
  showToast(message, duration = 3000) {
    if (!this.toast || !this.toastMessage) return;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastMessage.textContent = message;
    this.toast.classList.add('visible');

    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('visible');
      this.toastTimer = null;
    }, duration);
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // SVGs otimizados em linha para zero dependências
  getPlayIconSvg() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  getPauseIconSvg() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  }

  getVolumeIconSvg() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  }

  getMuteIconSvg() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
  }

  getTrashIconSvg() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  }
}
