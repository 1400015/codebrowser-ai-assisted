# CodeBrowser AI Assisted

Baseado no `codebrowser`. Mesma captura e segurança (Aprovar obrigatório, jail de path, sem execução),
mas o planner usa **modelos gratuitos do OpenRouter, escolhidos pelo utilizador**.

Documento de arquitectura: [`docs/arquitetura.md`](docs/arquitetura.md)
Manual do código: [`docs/manual.md`](docs/manual.md)
Registo de alterações: [`docs/alteracoes.md`](docs/alteracoes.md)

Um modelo local da família **Qwen Coder** (Ollama, default `qwen2.5-coder:7b`) só escolhe o ficheiro de destino e a acção. Sintaxe, jail de path e escrita são determinísticos. Nada é executado.

Documento de arquitectura: [`docs/arquitetura.md`](docs/arquitetura.md)  
Manual do código (origem, arquitectura e cada ficheiro/bloco): [`docs/manual.md`](docs/manual.md)

## O que já está nesta v0

- Captura híbrida: DOM (`pre > code`) → fences markdown → tags `<code-block>` opcionais
- IDs estáveis por SHA-256 de `(path, action, code)`
- Content scripts para ChatGPT, Grok, Qwen web e DeepSeek
- Side panel com inbox, aprovação de escrita e terminal de actividade
- Popup de canto com o mesmo log
- File System Access API **no side panel** (nunca no service worker)
- Planner determinístico + Ollama local + **OpenRouter (primário → fallback configuráveis)**
- Testes dos parsers, jail, plano e lista de modelos gratuitos

## Modelos AI

- Side panel → `Modelos OpenRouter gratuitos`: escolhe primário e fallback da lista `:free`.
- Default primário: `poolside/laguna-s-2.1:free` (rápido, coding-agent). Default fallback: `z-ai/glm-5.2:free`.
- A lista de modelos é actualizada em tempo real ao abrir o side panel (endpoint público `/models`); se não houver rede, usa a lista curada local. Guarda no GitHub: a oferta `:free` do OpenRouter muda com frequência — se um modelo escolhido deixar de existir, a chamada falha e cai para o próximo da ordem.
- Coloca a chave do OpenRouter no campo `Chave API`. Sem chave, usa Ollama e depois determinístico.
- Ordem de tentativa: `OpenRouter primário → OpenRouter fallback → Ollama → determinístico`.
- Chave guardada só em `chrome.storage.local`. Modelos em `chrome.storage.sync`. IDs retirados da oferta `:free` são re-mapeados para os defaults ao carregar.

## Requisitos

- Chrome, Chromium ou [BrowserOS](https://github.com/browseros-ai/BrowserOS)
- Node 20+
- (Opcional) [Ollama](https://ollama.com) com `ollama pull qwen2.5-coder:7b`

## Desenvolvimento

```bash
npm install
npm test
npm run build
```

A pasta `dist/` é a extensão empacotada.

1. Abre `chrome://extensions`
2. Activa *Developer mode*
3. *Load unpacked* → selecciona `dist/`
4. Abre o side panel pelo ícone da extensão
5. *Abrir pasta* e escolhe o root do projecto
6. Vai a um chat suportado e pede código

## Fluxo

```
chat web → content script (debounce 600 ms)
        → service worker (hash + dedup)
        → side panel (plano + aprovação)
        → Aprovar → File System Access escreve
```

O terminal mostra a mesma sequência no dock e no popup de canto.

## Modelo local

| Hardware | Tag Ollama |
|---|---|
| 8–16 GB | `qwen2.5-coder:7b` (default) |
| 24–32 GB VRAM / Mac 32 GB | `qwen3-coder:30b` |
| Emergência | `qwen2.5-coder:3b` |

Se o Ollama não estiver a correr, o plano determinístico continua a funcionar.

## Segurança

- Sem execução de código capturado
- Paths com `..` ou absolutos são rejeitados
- `.git` e `node_modules` não entram na árvore do planner e não são destinos de escrita (`.env` e `.github` são permitidos)
- `delete` e overwrite de `create` pedem confirmação
- Escrever exige o botão **Aprovar**
- `readFile` de path inválido falha; ficheiro em falta devolve `null`

## Estado

v0.2 — fronteiras de escrita e persistência. Selectors por plataforma vivem em `platforms/*.json`.

Licença: uso privado neste repositório até se decidir o contrário.
