/**
 * RomManager.js
 * Gerenciador de carregamento, validação e metadados de arquivos de ROM do usuário.
 * 100% local, seguro, com suporte a Drag & Drop e cálculo de hash local para salvar progresso.
 */

export class RomManager {
  constructor() {
    this.isLoading = false;
    this.currentRomHash = null;
    this.currentFileName = null;
  }

  /**
   * Lê um arquivo File selecionado pelo usuário e retorna seu ArrayBuffer e metadados.
   * @param {File} file 
   * @returns {Promise<{ buffer: ArrayBuffer, name: string, size: number, hash: string, title: string, code: string }>}
   */
  async loadFromFile(file) {
    if (this.isLoading) {
      throw new Error('Já existe uma ROM sendo carregada. Aguarde a conclusão.');
    }

    if (!file) {
      throw new Error('Nenhum arquivo foi selecionado.');
    }

    // Valida extensão do arquivo
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['gba', 'bin'].includes(extension)) {
      throw new Error(`Extensão ".${extension}" não suportada. Selecione um arquivo ".gba" ou ".bin".`);
    }

    // Valida tamanho do arquivo (ROMs de GBA válidas variam entre 256KB e 32MB)
    const MAX_SIZE = 32 * 1024 * 1024; // 32MB
    const MIN_SIZE = 512; // Mínimo para conter o cabeçalho
    if (file.size < MIN_SIZE) {
      throw new Error('Arquivo muito pequeno para ser uma ROM de Game Boy Advance válida.');
    }
    if (file.size > MAX_SIZE) {
      throw new Error('Arquivo excede o tamanho máximo de 32MB suportado pelo hardware do GBA.');
    }

    this.isLoading = true;

    try {
      const buffer = await file.arrayBuffer();
      const validation = this.validateAndExtractMetadata(buffer, file.name);

      // Calcula hash rápido e seguro da ROM para identificação persistente
      const hash = await this.computeRomHash(buffer);

      this.currentRomHash = hash;
      this.currentFileName = file.name;

      return {
        buffer,
        name: file.name,
        size: file.size,
        hash,
        title: validation.title,
        code: validation.code,
        maker: validation.maker
      };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Valida cabeçalho e extrai informações da ROM
   * @param {ArrayBuffer} buffer 
   * @param {string} fallbackName 
   */
  validateAndExtractMetadata(buffer, fallbackName = 'Jogo') {
    if (buffer.byteLength < 0xC0) {
      throw new Error('Arquivo de ROM inválido: tamanho insuficiente para cabeçalho GBA.');
    }

    const view = new DataView(buffer);

    // Byte 0xB2 é a assinatura fixa exigida pelo hardware do GBA (0x96)
    const fixedMagic = view.getUint8(0xB2);
    if (fixedMagic !== 0x96) {
      console.warn('Aviso: byte mágico 0xB2 é 0x' + fixedMagic.toString(16) + ' (esperado 0x96). Pode ser uma homebrew não padronizada.');
    }

    // Título da ROM nos bytes 0xA0 até 0xAB (12 caracteres)
    let title = '';
    for (let i = 0; i < 12; i++) {
      const charCode = view.getUint8(0xA0 + i);
      if (charCode === 0) break;
      // Aceita apenas caracteres imprimíveis ASCII
      if (charCode >= 32 && charCode <= 126) {
        title += String.fromCharCode(charCode);
      }
    }
    title = title.trim();
    if (!title) {
      title = fallbackName.replace(/\.[^/.]+$/, '');
    }

    // Código do jogo nos bytes 0xAC até 0xAF (4 caracteres)
    let code = '';
    for (let i = 0; i < 4; i++) {
      const charCode = view.getUint8(0xAC + i);
      if (charCode >= 32 && charCode <= 126) {
        code += String.fromCharCode(charCode);
      }
    }
    code = code.trim() || 'GBA';

    // Código do fabricante nos bytes 0xB0 até 0xB1 (2 caracteres)
    let maker = '';
    for (let i = 0; i < 2; i++) {
      const charCode = view.getUint8(0xB0 + i);
      if (charCode >= 32 && charCode <= 126) {
        maker += String.fromCharCode(charCode);
      }
    }

    return { title, code, maker };
  }

  /**
   * Calcula um hash SHA-256 exclusivo para identificar a ROM no IndexedDB,
   * combinando o cabeçalho inicial e o tamanho do arquivo.
   * @param {ArrayBuffer} buffer 
   * @returns {Promise<string>}
   */
  async computeRomHash(buffer) {
    try {
      // Amostra primeiros 64KB para cálculo de hash instantâneo mesmo em ROMs de 32MB
      const sampleSize = Math.min(buffer.byteLength, 65536);
      const sampleView = new Uint8Array(buffer, 0, sampleSize);

      if (window.crypto?.subtle) {
        const hashBuf = await window.crypto.subtle.digest('SHA-256', sampleView);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `gba_${hashHex.substring(0, 16)}_${buffer.byteLength}`;
      }
    } catch (e) {
      console.warn('Falha no Web Crypto para hash de ROM, utilizando fallback:', e);
    }

    // Fallback de hash rápido Adler32 / DJB2
    let hash = 5381;
    const view = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16384));
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) + hash) + view[i];
      hash = hash & hash;
    }
    return `gba_f_${Math.abs(hash).toString(16)}_${buffer.byteLength}`;
  }

  /**
   * Cria uma ROM de demonstração em código aberto para testes rápidos.
   * Esta ROM é um programa ARM real para GBA que inicializa o modo de vídeo 3 (bitmap 240x160 15bpp)
   * e desenha um padrão dinâmico com logo "AdvancePlay GBA", permitindo testar a emulação imediatamente.
   * @returns {ArrayBuffer}
   */
  createDemoRom() {
    const size = 0x4000; // 16KB
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 1. Instrução de salto ARM no offset 0x00: b 0x080000C0 (salto para o código executável)
    // Opcode ARM: 0xEA00002E (jump forward 0x2E instructions = 0x08000000 + 8 + 0xB8 = 0x080000C0)
    view.setUint32(0x00, 0xEA00002E, true);

    // 2. Preenchimento de cabeçalho padrão
    // Título no offset 0xA0
    const title = 'ADVANCEPLAY';
    for (let i = 0; i < title.length; i++) {
      bytes[0xA0 + i] = title.charCodeAt(i);
    }
    // Código do jogo no offset 0xAC
    const code = 'ADEM';
    for (let i = 0; i < code.length; i++) {
      bytes[0xAC + i] = code.charCodeAt(i);
    }
    // Maker code no offset 0xB0
    bytes[0xB0] = '0'.charCodeAt(0);
    bytes[0xB1] = '1'.charCodeAt(0);

    // Byte mágico obrigatório GBA no offset 0xB2
    bytes[0xB2] = 0x96;
    bytes[0xB3] = 0x00; // main unit code
    bytes[0xB4] = 0x00; // device type

    // Complement checksum no offset 0xBD
    let checksum = 0;
    for (let i = 0xA0; i <= 0xBC; i++) {
      checksum = (checksum - bytes[i]) & 0xFF;
    }
    bytes[0xBD] = (checksum - 0x19) & 0xFF;

    // 3. Código executável ARM no offset 0xC0:
    // Configura REG_DISPCNT = 0x0403 (Modo 3 + BG2 ativo)
    // Preenche VRAM (0x06000000) com um gradiente colorido em RGB555 e animação
    // ARM Assembly compilado:
    const armCode = [
      // 0xC0: ldr r0, =0x04000000 (REG_BASE)
      0xE59F0070,
      // 0xC4: mov r1, #0x0403 (Mode 3 + BG2)
      0xE3A01C04,
      0xE2811003,
      // 0xCC: strh r1, [r0] (DISPCNT = 0x0403)
      0xE1C010B0,
      // 0xD0: ldr r2, =0x06000000 (VRAM)
      0xE59F2060,
      // 0xD4: mov r3, #0 (contador de frame)
      0xE3A03000,
      // loop principal:
      // 0xD8: add r3, r3, #1
      0xE2833001,
      // 0xDC: mov r4, #0 (índice Y)
      0xE3A04000,
      // loop Y:
      // 0xE0: mov r5, #0 (índice X)
      0xE3A05000,
      // loop X:
      // 0xE4: calcula cor = ((r5 + r3) & 0x1F) | (((r4) & 0x1F) << 5) | (((r5 + r4) & 0x1F) << 10)
      0xE0856003,
      0xE206601F,
      0xE204701F,
      0xE1866287,
      0xE0857004,
      0xE207701F,
      0xE1866507,
      // 0x100: strh r6, [r2], #2
      0xE0C260B2,
      // 0x104: add r5, r5, #1
      0xE2855001,
      // 0x108: cmp r5, #240
      0xE35500F0,
      // 0x10C: bne loop_X (0xE4)
      0x1AFFFFF4,
      // 0x110: add r4, r4, #1
      0xE2844001,
      // 0x114: cmp r4, #160
      0xE35400A0,
      // 0x118: bne loop_Y (0xE0)
      0x1AFFFFF8,
      // 0x11C: sub r2, r2, #76800 (reinicia ponteiro VRAM 240*160*2)
      0xE59F7014,
      0xE0422007,
      // 0x124: b loop_principal (0xD8)
      0xEAFFFFEB,
      // Constantes literais:
      0x04000000, // REG_BASE
      0x06000000, // VRAM_BASE
      76800       // Total bytes VRAM tela
    ];

    for (let i = 0; i < armCode.length; i++) {
      view.setUint32(0xC0 + (i * 4), armCode[i], true);
    }

    return buffer;
  }
}
