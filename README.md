# AdvancePlay GBA Emulator

> **Emulador de Game Boy Advance para navegadores**, construído com HTML5, CSS3 e JavaScript puro (ES6+), utilizando o núcleo de código aberto **GBA.js** de **Jeffrey Pfau** ([github.com/endrift/gbajs](https://github.com/endrift/gbajs)).

AdvancePlay proporciona uma experiência moderna e de alta fidelidade para jogar títulos de GBA diretamente no navegador em computadores, tablets e celulares (Android e iOS).

---

## 🎮 Principais Características

- **Processamento 100% Local e Privado**: Nenhuma ROM é enviada para servidores ou APIs remotas. Todo o processamento ocorre no navegador via File API e Web Audio.
- **Carregamento Local de ROMs**: Suporte direto para arquivos `.gba` e `.bin` através de seletor nativo ou Drag & Drop.
- **Demonstração Integrada**: Inclui uma ROM de demonstração em código aberto desenvolvida especificamente para testes rápidos de vídeo e controles, sem exigir o download imediato de arquivos externos.
- **Vídeo Retrô de Alta Fidelidade**: Proporção clássica 3:2 (240x160), renderização de pixels nítida (`image-rendering: pixelated`), filtros ajustáveis (Pixel Sharp, Bilinear e linhas de varredura CRT/Scanlines) e suporte a tela cheia.
- **Sistema Unificado de Controles**:
  - **Teclado**: Atalhos padrão configurados e completamente remapeáveis nas configurações.
  - **Controles de Toque para Mobile**: D-pad ergonômico com suporte a 8 direções (inclusive diagonais), botões A, B, L, R, Start e Select com resposta háptica (vibração) e prevenção contra travamento de teclas.
  - **Gamepad API**: Detecção automática de controles físicos Bluetooth ou USB (Xbox, PlayStation, 8BitDo, Switch Pro e controles genéricos), com suporte a direcionais analógicos com zona morta anti-drift.
  - **Unificação Real**: Permite pressionar comandos simultâneos em fontes diferentes sem que um botão seja cancelado antes de todas as fontes serem soltas.
- **Gerenciamento de Jogos Salvos**:
  - Persistência automática no **IndexedDB** local identificado pelo hash da ROM.
  - Exportação para arquivos `.sav` compatíveis com outros emuladores (mGBA, VBA) e flashcarts físicos.
  - Importação de arquivos `.sav` existentes.
- **Histórico de Jogos Recentes**: Histórico local de jogos jogados, exibindo título, data e status do salvamento.

---

## 🕹️ Controles Padrão

### Teclado (Computador)

| Botão GBA | Tecla Padrão | Tecla Alternativa |
|---|---|---|
| **D-Pad Cima** | Seta para Cima (`ArrowUp`) | — |
| **D-Pad Baixo** | Seta para Baixo (`ArrowDown`) | — |
| **D-Pad Esquerda** | Seta para a Esquerda (`ArrowLeft`) | — |
| **D-Pad Direita** | Seta para a Direita (`ArrowRight`) | — |
| **Botão A** | `Z` | `K` |
| **Botão B** | `X` | `J` |
| **Gatilho L** | `A` | `U` |
| **Gatilho R** | `S` | `I` |
| **START** | `Enter` | — |
| **SELECT** | `Shift Direito` | `Shift Esquerdo` |

*Todas as teclas podem ser personalizadas no menu **Configurações > Controles**.*

### Controles Físicos (Gamepad API)

Compatível com controles USB e Bluetooth com mapeamento padrão:
- **D-Pad ou Analógico Esquerdo**: Movimentação (Cima, Baixo, Esquerda, Direita).
- **Botão Inferior (A / Cruz)**: Botão A do GBA.
- **Botão Esquerdo / Lateral (B / Círculo / X)**: Botão B do GBA.
- **Gatilhos L1 / L2**: Gatilho L do GBA.
- **Gatilhos R1 / R2**: Gatilho R do GBA.
- **Start / Options**: START.
- **Back / Select / Share**: SELECT.

---

## 📂 Estrutura do Projeto

```
.
├── index.html                  # Ponto de entrada HTML5 da aplicação
├── metadata.json               # Metadados e título do aplicativo
├── css/
│   ├── style.css               # Tema grafite escuro, design system e modais
│   ├── emulator.css            # Área de vídeo 3:2, barra de ferramentas e overlays
│   ├── controls.css            # Controles virtuais de toque e feedback tátil
│   └── responsive.css          # Adaptação para mobile vertical, landscape e desktop
├── js/
│   ├── app.js                  # Ponto de entrada e controlador central
│   ├── EmulatorAdapter.js      # Camada de integração com o núcleo GBA.js
│   ├── RomManager.js           # Validação, leitura local e geração de demo ROM
│   ├── InputManager.js         # Sistema unificado de entradas (teclado + touch + gamepad)
│   ├── TouchControls.js        # Gerenciador de controles virtuais de toque
│   ├── GamepadManager.js       # Gerenciador de controles físicos (Gamepad API)
│   ├── SaveManager.js          # Persistência com IndexedDB e import/export de .sav
│   ├── SettingsManager.js      # Configurações do usuário com localStorage
│   └── UIManager.js            # Interface visual, alternância de telas e diálogos
├── core/                       # Núcleo oficial GBA.js (Jeffrey Pfau)
│   ├── js/                     # Módulos originais do emulador (arm, mmu, video, audio, etc.)
│   └── resources/              # BIOS open-source de 220 bytes (bios.bin)
├── LICENSES/
│   └── GBA.js-LICENSE.txt      # Licença BSD de 2 cláusulas do GBA.js
└── README.md                   # Esta documentação
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (versão 18+) ou qualquer servidor estático de arquivos (ex: Live Server, Nginx, Python `http.server`).

### Executando em desenvolvimento:
```bash
npm install
npm run dev
```
Abra o navegador em `http://localhost:3000`.

### Gerando build estático para produção:
```bash
npm run build
```
O diretório `dist/` gerado conterá a aplicação estática pronta para ser hospedada gratuitamente.

---

## 🌐 Publicação em Hospedagem Estática Gratuita

A aplicação é puramente estática e pode ser publicada gratuitamente em:
- **GitHub Pages**
- **Cloudflare Pages**
- **Vercel / Netlify**

Basta carregar a pasta raiz do projeto ou o diretório de build gerado.

---

## ⚖️ Licença e Créditos

- **Núcleo de Emulação GBA.js**: Copyright © 2012–2013 Jeffrey Pfau ([github.com/endrift/gbajs](https://github.com/endrift/gbajs)), disponibilizado sob a **Licença BSD de 2 Cláusulas**. Consulte `LICENSES/GBA.js-LICENSE.txt`.
- **AdvancePlay Interface & Integração**: Desenvolvido em conformidade com as diretrizes de privacidade e código aberto.
- **Aviso Legal**: Game Boy Advance é marca registrada da Nintendo Co., Ltd. Este projeto é de código aberto para fins educativos e não é endossado nem associado à Nintendo.
