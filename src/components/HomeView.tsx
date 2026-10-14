import React, { useState, useRef, DragEvent } from 'react';
import {
  FolderOpen,
  History,
  Trash2,
  Play,
  Settings,
  ShieldCheck,
  Gamepad2,
  Sparkles,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { RecentGameItem } from '../storage/db';

interface HomeViewProps {
  onSelectRomFile: (file: File) => void;
  recentGames: RecentGameItem[];
  onRemoveRecentGame: (id: string) => void;
  onOpenSettings: () => void;
  isLoading: boolean;
  loadingMessage: string;
  errorMessage: string | null;
  onClearError: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectRomFile,
  recentGames,
  onRemoveRecentGame,
  onOpenSettings,
  isLoading,
  loadingMessage,
  errorMessage,
  onClearError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcessFile(file);
    }
    e.target.value = '';
  };

  const validateAndProcessFile = (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.gba' && ext !== '.bin') {
      alert('Formato não suportado. Por favor, selecione um arquivo de ROM .gba ou .bin.');
      return;
    }
    onClearError();
    onSelectRomFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full px-4 py-6 sm:py-10">
      {/* Top Bar with Brand & Settings Action */}
      <header className="flex items-center justify-between pb-8 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Gamepad2 className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Advance<span className="text-emerald-400">Play</span>
              <span className="text-[10px] tracking-widest font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                GBA
              </span>
            </h1>
            <p className="text-xs text-slate-400">Seus jogos de GBA, diretamente no navegador</p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-white/10 rounded-xl transition-all shadow-sm"
          aria-label="Abrir configurações"
        >
          <Settings className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Configurações</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 space-y-8">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={onClearError}
              className="text-rose-400 hover:text-rose-200 font-bold ml-3"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Dropzone & ROM Loader Card */}
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-emerald-400 bg-emerald-950/20 scale-[1.01]'
              : 'border-white/15 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".gba,.bin"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-inner">
            <FolderOpen className="w-8 h-8" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
            Carregue sua ROM do Game Boy Advance
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Selecione um arquivo <strong className="text-slate-200">.gba</strong> ou{' '}
            <strong className="text-slate-200">.bin</strong> do seu dispositivo ou arraste e solte o
            arquivo diretamente nesta área.
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="py-3.5 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{loadingMessage || 'Carregando ROM...'}</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-5 h-5" />
                <span>Abrir ROM</span>
              </>
            )}
          </button>

          {/* Privacy & File Notice */}
          <div className="mt-8 pt-6 border-t border-white/10 w-full max-w-md flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              100% Local no Navegador
            </span>
            <span className="text-slate-600">·</span>
            <span>Formatos: .GBA, .BIN</span>
            <span className="text-slate-600">·</span>
            <span>Sem Uploads</span>
          </div>
        </section>

        {/* Feature Highlights Pill Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-white/10 flex items-start gap-3">
            <Cpu className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">Núcleo GBA.js</div>
              <div className="text-slate-400 mt-0.5">
                Emulação pura em HTML5 Canvas e Web Audio, por Jeffrey Pfau.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-white/10 flex items-start gap-3">
            <Gamepad2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">Entrada Unificada</div>
              <div className="text-slate-400 mt-0.5">
                Teclado remapeável, controles de toque mobile e Gamepad API física.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-white/10 flex items-start gap-3">
            <HardDrive className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">Saves no IndexedDB</div>
              <div className="text-slate-400 mt-0.5">
                Seu progresso fica salvo com segurança no navegador com exportação .SAV.
              </div>
            </div>
          </div>
        </div>

        {/* Recent Games Section */}
        {recentGames && recentGames.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-400" />
                Histórico de Jogos Recentes
              </h3>
              <span className="text-xs text-slate-400">{recentGames.length} registrado(s)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentGames.map((game) => (
                <div
                  key={game.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/30 transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-bold text-white text-sm truncate flex items-center gap-2">
                      {game.title || game.fileName}
                      {game.gameCode && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1 py-0.5 rounded">
                          {game.gameCode}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>{formatDate(game.lastPlayed)}</span>
                      <span>·</span>
                      <span>{formatFileSize(game.fileSize)}</span>
                      {game.hasSave && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400 font-medium">Progresso Local</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Abrir arquivo de ROM novamente"
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 transition-colors"
                      aria-label="Reabrir jogo"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveRecentGame(game.id)}
                      title="Remover do histórico"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      aria-label="Remover do histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              * Por restrições de segurança do navegador, selecione novamente o arquivo da ROM ao
              reiniciar uma sessão de um jogo recente. Seu arquivo de save salvo no IndexedDB será
              restaurado automaticamente!
            </p>
          </section>
        )}
      </main>

      {/* Footer / Copyright / License */}
      <footer className="pt-8 border-t border-white/10 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          AdvancePlay — Desenvolvido com{' '}
          <a
            href="https://github.com/endrift/gbajs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline font-medium"
          >
            GBA.js
          </a>{' '}
          por Jeffrey Pfau (Licença BSD 2-Clause).
        </div>
        <div className="text-[11px] text-slate-400">
          Utilize apenas ROMs autorizadas das quais você possua cópia legal.
        </div>
      </footer>
    </div>
  );
};
