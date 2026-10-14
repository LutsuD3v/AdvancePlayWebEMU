import React, { useState, useEffect } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DEFAULT_KEY_MAPPING,
  saveAppSettings,
  KeyMapping,
  listAllSaves,
} from '../storage/db';
import { EmulatorAdapter } from '../emulator/EmulatorAdapter';
import {
  X,
  Keyboard,
  Gamepad2,
  Tv,
  Volume2,
  Smartphone,
  Save,
  RotateCcw,
  Info,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  adapter: EmulatorAdapter | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  adapter,
}) => {
  const [activeTab, setActiveTab] = useState<
    'video' | 'audio' | 'controls' | 'touch' | 'saves' | 'about'
  >('video');
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
  const [listeningKeyFor, setListeningKeyFor] = useState<keyof KeyMapping | null>(null);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      listAllSaves().then((saves) => setSavedCount(saves.length));
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Escuta tecla para remapeamento
  useEffect(() => {
    if (!listeningKeyFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newKey = e.code;
      setCurrentSettings((prev) => {
        const updated = {
          ...prev,
          keyMapping: {
            ...prev.keyMapping,
            [listeningKeyFor]: newKey,
          },
        };
        saveAppSettings(updated);
        onSaveSettings(updated);
        return updated;
      });

      setListeningKeyFor(null);
      showToast(`Tecla para ${listeningKeyFor} alterada para ${newKey}`);
    };

    window.addEventListener('keydown', handleKeyDown, { once: true });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningKeyFor, onSaveSettings]);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...currentSettings, [key]: value };
    setCurrentSettings(updated);
    saveAppSettings(updated);
    onSaveSettings(updated);
    adapter?.updateSettings(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar todas as configurações para os padrões originais?')) {
      setCurrentSettings(DEFAULT_SETTINGS);
      saveAppSettings(DEFAULT_SETTINGS);
      onSaveSettings(DEFAULT_SETTINGS);
      adapter?.updateSettings(DEFAULT_SETTINGS);
      showToast('Configurações restauradas para o padrão.');
    }
  };

  const keyDisplay = (code: string) => {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'ArrowUp') return '↑ Cima';
    if (code === 'ArrowDown') return '↓ Baixo';
    if (code === 'ArrowLeft') return '← Esquerda';
    if (code === 'ArrowRight') return '→ Direita';
    if (code === 'Enter') return 'Enter';
    if (code === 'ShiftRight') return 'Shift Dir';
    if (code === 'ShiftLeft') return 'Shift Esq';
    if (code === 'Space') return 'Espaço';
    return code;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#161b26]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-wide">Configurações</h2>
            {successToast && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                <Check className="w-3 h-3" /> {successToast}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Fechar configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-[#0e1118] border-b border-white/5 overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'video'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> Vídeo
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'audio'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> Áudio
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'controls'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Teclado & Gamepad
          </button>
          <button
            onClick={() => setActiveTab('touch')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'touch'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Toque (Mobile)
          </button>
          <button
            onClick={() => setActiveTab('saves')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'saves'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Save className="w-3.5 h-3.5" /> Memória & Saves
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'about'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Info className="w-3.5 h-3.5" /> Sobre
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {/* TAB: VÍDEO */}
          {activeTab === 'video' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Filtro de Imagem
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdate('videoFilter', 'pixelated')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      currentSettings.videoFilter === 'pixelated'
                        ? 'border-emerald-500 bg-emerald-950/20 text-white'
                        : 'border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="font-semibold text-white">Pixelado Nítido (Recomendado)</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Renderização pixel-art nítida sem desfoque (pixelated).
                    </div>
                  </button>

                  <button
                    onClick={() => handleUpdate('videoFilter', 'smooth')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      currentSettings.videoFilter === 'smooth'
                        ? 'border-emerald-500 bg-emerald-950/20 text-white'
                        : 'border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="font-semibold text-white">Suavização Bilinear</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Interpolação suave dos pixels na ampliação.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Escala de Visualização
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fit', '2x', '3x'] as const).map((scale) => (
                    <button
                      key={scale}
                      onClick={() => handleUpdate('videoScale', scale)}
                      className={`py-2.5 px-3 rounded-lg border text-center font-medium transition-all text-xs ${
                        currentSettings.videoScale === scale
                          ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                          : 'border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {scale === 'fit' ? 'Ajustar à Tela' : scale === '2x' ? '2x (480x320)' : '3x (720x480)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ÁUDIO */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/50 rounded-xl border border-white/10">
                <div>
                  <div className="font-medium text-white">Silenciar Áudio</div>
                  <div className="text-xs text-slate-400">Desativa toda a saída sonora do emulador.</div>
                </div>
                <input
                  type="checkbox"
                  checked={currentSettings.audioMuted}
                  onChange={(e) => handleUpdate('audioMuted', e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-2 p-3.5 bg-slate-900/50 rounded-xl border border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider">Volume Master</span>
                  <span className="text-emerald-400 font-mono">
                    {Math.round(currentSettings.audioVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentSettings.audioVolume}
                  onChange={(e) => handleUpdate('audioVolume', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="text-xs text-slate-400 bg-slate-900/40 p-3 rounded-lg border border-white/5">
                O áudio utiliza o Web Audio API nativo do navegador integrado diretamente ao núcleo de som
                do GBA.js.
              </div>
            </div>
          )}

          {/* TAB: CONTROLES (TECLADO & GAMEPAD) */}
          {activeTab === 'controls' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Mapeamento de Teclado
                  </label>
                  <button
                    onClick={() => {
                      const updated = { ...currentSettings, keyMapping: DEFAULT_KEY_MAPPING };
                      setCurrentSettings(updated);
                      saveAppSettings(updated);
                      onSaveSettings(updated);
                      showToast('Teclas restauradas para o padrão.');
                    }}
                    className="text-xs text-slate-400 hover:text-emerald-400"
                  >
                    Restaurar Teclas
                  </button>
                </div>

                {listeningKeyFor && (
                  <div className="p-3 mb-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-center text-xs text-emerald-300 animate-pulse font-medium">
                    Pressione qualquer tecla para configurar {listeningKeyFor}... (ou clique fora para cancelar)
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(Object.keys(currentSettings.keyMapping) as Array<keyof KeyMapping>).map((keyName) => {
                    const isListening = listeningKeyFor === keyName;
                    return (
                      <div
                        key={keyName}
                        className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-lg border border-white/10"
                      >
                        <span className="font-bold text-slate-300">Botão {keyName}</span>
                        <button
                          onClick={() => setListeningKeyFor(keyName)}
                          className={`px-2.5 py-1 rounded font-mono font-bold transition-colors ${
                            isListening
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400'
                              : 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-white/10'
                          }`}
                        >
                          {isListening ? 'Aguardando...' : keyDisplay(currentSettings.keyMapping[keyName])}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gamepad Status */}
              <div className="p-4 bg-slate-900/50 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2 font-semibold text-white text-xs uppercase tracking-wider">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  Suporte a Controles Físicos (Gamepad API)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Controles compatíveis (Xbox, PlayStation, 8BitDo, Nintendo Switch Pro) conectados por USB ou
                  Bluetooth são detectados automaticamente pelo navegador.
                </p>
                <div className="mt-3 text-xs bg-slate-950/50 p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Status atual:</span>
                  <span className="font-semibold text-emerald-400">
                    {adapter?.getStatus().gamepadConnected
                      ? `Conectado: ${adapter.getStatus().gamepadName}`
                      : 'Nenhum controle detectado'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TOQUE MOBILE */}
          {activeTab === 'touch' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/50 rounded-xl border border-white/10">
                <div>
                  <div className="font-medium text-white">Exibir Controles Virtuais</div>
                  <div className="text-xs text-slate-400">
                    Mostra os botões de toque e direcional na tela.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={currentSettings.touchControls}
                  onChange={(e) => handleUpdate('touchControls', e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-2 p-3.5 bg-slate-900/50 rounded-xl border border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider">
                    Opacidade dos Botões
                  </span>
                  <span className="text-emerald-400 font-mono">
                    {Math.round(currentSettings.touchOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={currentSettings.touchOpacity}
                  onChange={(e) => handleUpdate('touchOpacity', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Tamanho dos Controles
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleUpdate('touchSize', size)}
                      className={`py-2 px-3 rounded-lg border text-center font-medium transition-all text-xs ${
                        currentSettings.touchSize === size
                          ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                          : 'border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {size === 'sm' ? 'Pequeno' : size === 'md' ? 'Médio (Padrão)' : 'Grande'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: JOGOS SALVOS */}
          {activeTab === 'saves' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-900/50 rounded-xl border border-white/10">
                <div className="font-medium text-white text-xs uppercase tracking-wider mb-1">
                  Persistência Local (IndexedDB)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Os dados salvos dentro do cartucho (SRAM, Flash 512k/1M, EEPROM) são gravados localmente no
                  banco de dados IndexedDB do seu navegador.
                </p>
                <div className="mt-3 text-xs bg-slate-950/50 p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Total de jogos com progresso salvo:</span>
                  <span className="font-semibold text-emerald-400">{savedCount}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    const exported = adapter?.exportSaveFile();
                    if (exported) {
                      showToast('Arquivo de save baixado com sucesso!');
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/10 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4 text-emerald-400" />
                  Exportar .SAV do Jogo Atual
                </button>

                <label className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/10 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors text-center">
                  <Save className="w-4 h-4 text-cyan-400" />
                  Importar .SAV para Jogo Atual
                  <input
                    type="file"
                    accept=".sav"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && adapter) {
                        const ok = await adapter.importSaveFile(file);
                        if (ok) {
                          showToast('Arquivo de save importado com sucesso!');
                          listAllSaves().then((saves) => setSavedCount(saves.length));
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB: SOBRE & CRÉDITOS */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 text-xs">
                    GBA
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">AdvancePlay GBA Web</h3>
                    <p className="text-xs text-slate-400">Versão 1.0.0 — Emulador HTML5 & Web Audio</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 text-xs text-slate-400 space-y-2 leading-relaxed">
                  <p>
                    <strong className="text-slate-200">Núcleo de Emulação:</strong>{' '}
                    <a
                      href="https://github.com/endrift/gbajs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline"
                    >
                      GBA.js (Jeffrey Pfau / endrift)
                    </a>
                    , disponibilizado sob a licença open-source <strong>BSD 2-Clause</strong>.
                  </p>
                  <p>
                    <strong className="text-slate-200">Privacidade:</strong> Toda a execução ocorre
                    estritamente no navegador do usuário. Nenhuma ROM ou dado de jogo salvo é enviado para
                    servidores externos.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#161b26] text-xs">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrões
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
