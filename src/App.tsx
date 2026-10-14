import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EmulatorAdapter,
  EmulatorStatus,
} from './emulator/EmulatorAdapter';
import {
  AppSettings,
  getAppSettings,
  getRecentGames,
  removeRecentGame,
  RecentGameItem,
} from './storage/db';
import { HomeView } from './components/HomeView';
import { EmulatorView } from './components/EmulatorView';
import { SettingsModal } from './components/SettingsModal';
import { useKeyboardControls } from './hooks/useKeyboardControls';

export default function App() {
  const [activeView, setActiveView] = useState<'home' | 'emulator'>('home');
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [recentGames, setRecentGames] = useState<RecentGameItem[]>(() => getRecentGames());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [currentFps, setCurrentFps] = useState(60);

  const [status, setStatus] = useState<EmulatorStatus>({
    isInitialized: false,
    hasRom: false,
    isRunning: false,
    isPaused: false,
    fps: 60,
    gameTitle: '',
    gameCode: '',
    gameMaker: '',
    saveType: '',
    gamepadConnected: false,
    gamepadName: '',
  });

  const adapterRef = useRef<EmulatorAdapter | null>(null);

  const showNotification = useCallback((msg: string) => {
    setNotificationMessage(msg);
    setTimeout(() => {
      setNotificationMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Inicializa o adaptador do emulador uma única vez
  useEffect(() => {
    const adapter = new EmulatorAdapter({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onFpsUpdate: (fps) => {
        setCurrentFps(fps);
      },
      onSaveUpdated: (title) => {
        showNotification(`Progresso salvo no IndexedDB: ${title}`);
        setRecentGames(getRecentGames());
      },
      onError: (err) => {
        setErrorMessage(err);
        setIsLoading(false);
      },
    });

    adapterRef.current = adapter;

    return () => {
      adapter.destroy();
    };
  }, [showNotification]);

  // Hook de controle por teclado
  useKeyboardControls({
    adapter: adapterRef.current,
    settings,
    isActive: activeView === 'emulator' && status.isRunning,
    isModalOpen: isSettingsOpen,
  });

  // Carregamento de arquivo de ROM
  const handleSelectRomFile = async (file: File) => {
    if (!adapterRef.current) return;

    setIsLoading(true);
    setLoadingMessage(`Lendo ${file.name}...`);
    setErrorMessage(null);

    try {
      // Leitura local via FileReader / ArrayBuffer
      const buffer = await file.arrayBuffer();

      setLoadingMessage('Validando cabeçalho da ROM...');
      const check = adapterRef.current.validateRom(buffer);
      if (!check.valid) {
        setErrorMessage(
          check.error ||
            'O arquivo selecionado não é uma ROM válida de Game Boy Advance (.gba ou .bin).'
        );
        setIsLoading(false);
        return;
      }

      setLoadingMessage('Inicializando emulação...');
      // Mudamos para a tela do emulador para renderizar o canvas antes do loadRom se necessário
      setActiveView('emulator');

      // Aguarda pequeno frame para que o elemento canvas seja montado no DOM
      setTimeout(async () => {
        try {
          const canvas = document.getElementById('screen') as HTMLCanvasElement;
          if (canvas && adapterRef.current) {
            await adapterRef.current.initialize(canvas);
            const success = await adapterRef.current.loadRom(buffer, file.name);
            if (success) {
              setRecentGames(getRecentGames());
              showNotification(`Jogo carregado: ${check.title || file.name}`);
            }
          }
        } catch (loadErr) {
          console.error('Erro ao iniciar jogo:', loadErr);
          setErrorMessage(
            loadErr instanceof Error ? loadErr.message : 'Falha ao executar o jogo no emulador.'
          );
          setActiveView('home');
        } finally {
          setIsLoading(false);
        }
      }, 50);
    } catch (err) {
      console.error('Erro de leitura do arquivo:', err);
      setErrorMessage('Falha ao ler o arquivo local do dispositivo.');
      setIsLoading(false);
    }
  };

  const handleRemoveRecent = (id: string) => {
    removeRecentGame(id);
    setRecentGames(getRecentGames());
    showNotification('Jogo removido do histórico recente.');
  };

  const handleReturnHome = () => {
    adapterRef.current?.stop();
    setActiveView('home');
  };

  return (
    <div className="min-h-screen bg-[#0b0d11] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {activeView === 'home' ? (
        <HomeView
          onSelectRomFile={handleSelectRomFile}
          recentGames={recentGames}
          onRemoveRecentGame={handleRemoveRecent}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      ) : (
        <EmulatorView
          adapter={adapterRef.current}
          status={status}
          settings={settings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onReturnHome={handleReturnHome}
          onSelectNewRom={handleSelectRomFile}
          fps={currentFps}
          notificationMessage={notificationMessage}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          adapterRef.current?.updateSettings(newSettings);
        }}
        adapter={adapterRef.current}
      />
    </div>
  );
}
