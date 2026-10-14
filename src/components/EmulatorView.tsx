import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Home,
  Camera,
  Save,
  Gamepad2,
  FolderOpen,
} from 'lucide-react';
import { EmulatorAdapter, EmulatorStatus } from '../emulator/EmulatorAdapter';
import { AppSettings } from '../storage/db';
import { VirtualControls } from './VirtualControls';

interface EmulatorViewProps {
  adapter: EmulatorAdapter | null;
  status: EmulatorStatus;
  settings: AppSettings;
  onOpenSettings: () => void;
  onReturnHome: () => void;
  onSelectNewRom: (file: File) => void;
  fps: number;
  notificationMessage: string | null;
}

export const EmulatorView: React.FC<EmulatorViewProps> = ({
  adapter,
  status,
  settings,
  onOpenSettings,
  onReturnHome,
  onSelectNewRom,
  fps,
  notificationMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isHomeConfirmOpen, setIsHomeConfirmOpen] = useState(false);

  // Monitora alterações de Fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Vincula o canvas ao emulador se ainda não foi feito
  useEffect(() => {
    if (canvasRef.current && adapter && !status.isInitialized) {
      adapter.initialize(canvasRef.current).catch((err) => {
        console.error('Falha ao inicializar canvas:', err);
      });
    }
  }, [adapter, status.isInitialized]);

  const handleTogglePlayPause = async () => {
    if (!adapter) return;
    await adapter.togglePause();
  };

  const handleReset = async () => {
    if (!adapter) return;
    await adapter.reset();
    setIsResetConfirmOpen(false);
  };

  const handleReturnHomeSafe = () => {
    if (status.isRunning) {
      setIsHomeConfirmOpen(true);
    } else {
      onReturnHome();
    }
  };

  const confirmReturnHome = () => {
    setIsHomeConfirmOpen(false);
    adapter?.stop();
    onReturnHome();
  };

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Erro ao alternar tela cheia:', err);
    }
  };

  const handleToggleMute = () => {
    if (!adapter) return;
    adapter.setMuted(!settings.audioMuted);
  };

  const handleScreenshot = () => {
    adapter?.takeScreenshot();
  };

  const handleExportSave = () => {
    adapter?.exportSaveFile();
  };

  const handleSaveImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && adapter) {
      await adapter.importSaveFile(file);
    }
    e.target.value = '';
  };

  const handleNewRomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectNewRom(file);
    }
    e.target.value = '';
  };

  // Determina classe de escala de vídeo
  const getScaleStyle = () => {
    if (settings.videoScale === '2x') {
      return { width: '480px', height: '320px', maxWidth: '100%' };
    }
    if (settings.videoScale === '3x') {
      return { width: '720px', height: '480px', maxWidth: '100%' };
    }
    return { width: '100%', height: 'auto', aspectRatio: '3 / 2' };
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col justify-between w-full h-full min-h-screen bg-[#07090c] overflow-hidden select-none"
    >
      {/* Hidden file selectors */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gba,.bin"
        className="hidden"
        onChange={handleNewRomChange}
      />
      <input
        ref={saveInputRef}
        type="file"
        accept=".sav"
        className="hidden"
        onChange={handleSaveImportChange}
      />

      {/* Top Session Toolbar */}
      <header className="z-30 flex items-center justify-between px-3 sm:px-6 py-2 bg-[#0e121a]/95 border-b border-white/10 backdrop-blur-md">
        {/* Left: Home button & Game Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleReturnHomeSafe}
            title="Voltar à tela inicial"
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Voltar para início"
          >
            <Home className="w-4 h-4 sm:w-5 h-5 text-emerald-400" />
          </button>

          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs md:max-w-md">
              {status.gameTitle || 'Game Boy Advance'}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
              {status.gameCode && <span className="font-mono text-emerald-400">{status.gameCode}</span>}
              {status.gameCode && <span>·</span>}
              <span className="font-mono">{fps || status.fps || 60} FPS</span>
            </div>
          </div>
        </div>

        {/* Center: Gamepad status badge if connected */}
        {status.gamepadConnected && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-[160px]">{status.gamepadName || 'Gamepad'}</span>
          </div>
        )}

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Pause / Play */}
          <button
            onClick={handleTogglePlayPause}
            title={status.isPaused ? 'Continuar jogo' : 'Pausar jogo'}
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={status.isPaused ? 'Continuar' : 'Pausar'}
          >
            {status.isPaused ? (
              <Play className="w-4 h-4 sm:w-5 h-5 text-emerald-400 fill-emerald-400" />
            ) : (
              <Pause className="w-4 h-4 sm:w-5 h-5 text-amber-400" />
            )}
          </button>

          {/* Reset */}
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            title="Reiniciar jogo atual"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-colors"
            aria-label="Reiniciar"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 h-5" />
          </button>

          {/* Audio Mute & Volume Popover */}
          <div className="relative">
            <button
              onClick={handleToggleMute}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowVolumeSlider(!showVolumeSlider);
              }}
              title="Alternar áudio (ou clique com botão direito para volume)"
              className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Controle de Áudio"
            >
              {settings.audioMuted ? (
                <VolumeX className="w-4 h-4 sm:w-5 h-5 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 h-5 text-emerald-400" />
              )}
            </button>
          </div>

          {/* Screenshot */}
          <button
            onClick={handleScreenshot}
            title="Capturar imagem da tela (Screenshot)"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors hidden xs:flex"
            aria-label="Captura de tela"
          >
            <Camera className="w-4 h-4 sm:w-5 h-5" />
          </button>

          {/* Export / Download Savegame */}
          <button
            onClick={handleExportSave}
            title="Baixar arquivo de save (.sav)"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex"
            aria-label="Exportar save"
          >
            <Save className="w-4 h-4 sm:w-5 h-5" />
          </button>

          {/* Trocar ROM */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Trocar de ROM"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex"
            aria-label="Trocar de ROM"
          >
            <FolderOpen className="w-4 h-4 sm:w-5 h-5 text-cyan-400" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleToggleFullscreen}
            title="Tela cheia"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Tela cheia"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 sm:w-5 h-5" />
            ) : (
              <Maximize className="w-4 h-4 sm:w-5 h-5" />
            )}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Abrir configurações"
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Configurações"
          >
            <Settings className="w-4 h-4 sm:w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </header>

      {/* Center Video Area */}
      <main className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Subtle retro bezel wrapper */}
        <div className="relative flex items-center justify-center max-w-full max-h-full">
          <canvas
            id="screen"
            ref={canvasRef}
            width={480}
            height={320}
            style={getScaleStyle()}
            className={`block rounded-lg shadow-2xl bg-black border border-white/10 ${
              settings.videoFilter === 'pixelated' ? 'canvas-pixelated' : 'canvas-smooth'
            }`}
          />

          {/* Pause overlay message */}
          {status.isPaused && (
            <div
              onClick={handleTogglePlayPause}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/90 text-slate-950 flex items-center justify-center shadow-lg mb-2">
                <Play className="w-7 h-7 fill-slate-950 ml-1" />
              </div>
              <span className="text-white font-bold text-sm tracking-wider uppercase">Pausado</span>
              <span className="text-slate-400 text-xs mt-1">Toque ou clique para continuar</span>
            </div>
          )}

          {/* Notification Toast */}
          {notificationMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/90 text-emerald-200 border border-emerald-500/40 text-xs font-semibold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {notificationMessage}
            </div>
          )}
        </div>
      </main>

      {/* Virtual Touch Controls (Always available for mobile screens) */}
      <footer className="z-20 pb-safe pt-1">
        <VirtualControls adapter={adapter} settings={settings} />
      </footer>

      {/* Confirmation Dialog: Reset */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#12161f] border border-white/15 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4">
            <h4 className="font-bold text-white text-base">Reiniciar Jogo?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              O progresso não salvo desde o último salvamento interno do jogo será perdido. Deseja
              reinicializar a emulação agora?
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-lg"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Return Home */}
      {isHomeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#12161f] border border-white/15 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4">
            <h4 className="font-bold text-white text-base">Sair para o Início?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              A sessão atual do emulador será encerrada. Os dados já salvos no jogo estão seguros no seu
              IndexedDB.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setIsHomeConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Continuar Jogando
              </button>
              <button
                onClick={confirmReturnHome}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg"
              >
                Sair para Início
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
