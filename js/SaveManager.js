/**
 * SaveManager.js
 * Gerenciador de jogos salvos e histórico recente.
 * Utiliza IndexedDB para persistência segura de dados de cartucho (SRAM / Flash / EEPROM)
 * e permite importação/exportação de arquivos .sav compatíveis com emuladores reais.
 */

const DB_NAME = 'advanceplay_saves_db';
const DB_VERSION = 1;
const STORE_NAME = 'cartridge_saves';
const RECENT_KEY = 'advanceplay_recent_games_v1';

export class SaveManager {
  constructor() {
    this.db = null;
    this.isSupported = typeof window.indexedDB !== 'undefined';
  }

  /**
   * Inicializa o banco IndexedDB
   */
  async init() {
    if (!this.isSupported) {
      console.warn('IndexedDB não suportado neste navegador. Progresso em sessão atual apenas.');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'romId' });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(true);
        };

        request.onerror = (event) => {
          console.warn('Erro ao abrir IndexedDB:', event.target.error);
          resolve(false);
        };
      } catch (e) {
        console.warn('Exceção ao inicializar IndexedDB:', e);
        resolve(false);
      }
    });
  }

  /**
   * Salva os dados de memória persistente da ROM no IndexedDB
   * @param {string} romId 
   * @param {string} title 
   * @param {string} code 
   * @param {Uint8Array|ArrayBuffer} saveBuffer 
   */
  async save(romId, title, code, saveBuffer) {
    if (!romId || !saveBuffer) return false;

    // Normaliza para Uint8Array
    const data = saveBuffer instanceof Uint8Array ? saveBuffer : new Uint8Array(saveBuffer);

    // Se estiver vazio (todos zeros), ainda assim armazena se for tamanho padrão
    const record = {
      romId,
      title: title || 'Jogo',
      code: code || 'GBA',
      data: data.buffer,
      size: data.byteLength,
      updatedAt: Date.now()
    };

    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      } catch (e) {
        console.warn('Falha ao gravar save no IndexedDB:', e);
      }
    }

    // Atualiza metadado no histórico
    this.updateRecentGame({
      romId,
      title,
      code,
      lastPlayed: Date.now(),
      hasSave: true,
      saveSize: data.byteLength
    });

    return true;
  }

  /**
   * Carrega dados de save salvos localmente no IndexedDB
   * @param {string} romId 
   * @returns {Promise<ArrayBuffer|null>}
   */
  async load(romId) {
    if (!this.db || !romId) return null;

    try {
      return await new Promise((resolve) => {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(romId);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve(req.result.data);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('Erro ao ler save do IndexedDB:', e);
      return null;
    }
  }

  /**
   * Verifica se existe jogo salvo para a ROM fornecida
   * @param {string} romId 
   * @returns {Promise<boolean>}
   */
  async hasSave(romId) {
    if (!this.db || !romId) return false;
    try {
      const data = await this.load(romId);
      return data !== null && data.byteLength > 0;
    } catch {
      return false;
    }
  }

  /**
   * Deleta save do banco de dados local
   * @param {string} romId 
   */
  async deleteSave(romId) {
    if (!this.db || !romId) return false;
    try {
      await new Promise((resolve) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(romId);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
      this.updateRecentGameSaveStatus(romId, false);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Exporta os dados de save atuais em um arquivo baixável (.sav)
   * Compatível com hardware real e outros emuladores como mGBA e VisualBoyAdvance.
   * @param {string} title 
   * @param {string} code 
   * @param {Uint8Array|ArrayBuffer} saveBuffer 
   */
  exportSaveFile(title, code, saveBuffer) {
    if (!saveBuffer) {
      throw new Error('Nenhum dado de salvamento disponível para exportação.');
    }

    const data = saveBuffer instanceof Uint8Array ? saveBuffer : new Uint8Array(saveBuffer);
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    // Sanitiza nome de arquivo
    const cleanTitle = (title || 'savegame').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${code || 'GBA'}.sav`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return fileName;
  }

  /**
   * Lê um arquivo .sav carregado pelo usuário
   * @param {File} file 
   * @returns {Promise<ArrayBuffer>}
   */
  async importSaveFile(file) {
    if (!file) {
      throw new Error('Selecione um arquivo de save (.sav).');
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'sav') {
      throw new Error('Formato inválido. O arquivo de jogo salvo deve ter extensão .sav.');
    }

    const MAX_SAVE_SIZE = 1024 * 1024; // 1MB (GBA Flash 1M é o maior save suportado)
    if (file.size > MAX_SAVE_SIZE) {
      throw new Error('Arquivo de save excede o limite máximo de 1MB.');
    }

    return await file.arrayBuffer();
  }

  /**
   * Retorna a lista de jogos recentes salvos no localStorage
   * @returns {Array}
   */
  getRecentGames() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('Erro ao carregar histórico de jogos recentes:', e);
      return [];
    }
  }

  /**
   * Registra ou atualiza um jogo na lista de recentes (máximo 10)
   * @param {Object} item 
   */
  updateRecentGame(item) {
    try {
      const list = this.getRecentGames();
      const index = list.findIndex(g => g.romId === item.romId);

      const entry = {
        romId: item.romId,
        title: item.title || 'Jogo',
        code: item.code || 'GBA',
        fileName: item.fileName || (item.title ? `${item.title}.gba` : 'jogo.gba'),
        lastPlayed: item.lastPlayed || Date.now(),
        hasSave: item.hasSave ?? false,
        saveSize: item.saveSize ?? 0
      };

      if (index >= 0) {
        list[index] = { ...list[index], ...entry };
      } else {
        list.unshift(entry);
      }

      // Ordena por data decrescente e limita aos 8 mais recentes
      list.sort((a, b) => b.lastPlayed - a.lastPlayed);
      const trimmed = list.slice(0, 8);

      localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Erro ao persistir histórico recente:', e);
    }
  }

  /**
   * Atualiza apenas o status de save de um jogo recente
   */
  updateRecentGameSaveStatus(romId, hasSave) {
    try {
      const list = this.getRecentGames();
      const item = list.find(g => g.romId === romId);
      if (item) {
        item.hasSave = hasSave;
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      }
    } catch (e) {}
  }

  /**
   * Remove um jogo da lista de recentes
   * @param {string} romId 
   */
  removeRecentGame(romId) {
    try {
      const list = this.getRecentGames().filter(g => g.romId !== romId);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      return list;
    } catch (e) {
      return [];
    }
  }

  /**
   * Limpa todo o histórico de recentes
   */
  clearRecentGames() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch (e) {}
  }
}
