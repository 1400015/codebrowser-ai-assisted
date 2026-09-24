# Captura

Voltar ao [manual](../manual.md).

## `watchdog.ts`

600 ms sem mutações → `onStable`. Sem isto cada token do stream gera `RAW_CAPTURE`.

## `hash.ts`

`blockId` = SHA-256 de `path + action + code`. SubtleCrypto no browser; FNV-1a só nos testes Node.

## Parsers

- `path-hints.ts` — `// file:`, `# file:`, `-- path:` nas primeiras 8 linhas. Não faz jail.
- `xml-markers.ts` — tag opcional. Os chats comerciais não a emitem sozinhos.
- `markdown-fences.ts` — o caso real. Língua no info-string + hint no corpo.
- `index.ts` — XML ganha se o corpo for o mesmo.

## `capture/toolbar.ts` — a heurística dos botões copiar/descarregar (2026-09-23)

A ideia do utilizador: os chats renderizam cada bloco de código com uma toolbar local (copiar / descarregar). Esse padrão é **mais estável do que as classes da mensagem** — redesenham a UI, mas o botão "copiar" fica. Três funções:

- `isCopyDownloadLabel` — pura, testável em node. Casa sinais pt/en/**zh** ("copiar código", "copy", "复制", "下载", "clipboard"…) em aria-label, title, classe, texto do botão ou `href` de ícone (SVG só-ícone, caso DeepSeek).
- `hasCodeToolbar(pre)` — true se o `pre` tiver toolbar com sinal nos irmãos anteriores, pai ou avô (inclui candidatos `svg`/`use`).
- `findToolbarCodeBlocks(root)` — TODOS os `pre` com toolbar, atravessando shadow roots. Fallback universal: se os selectores da plataforma falharem, os blocos com botão de copiar continuam a ser capturados.
- `findToolbarCodeContainers(root)` (2026-09-23, tarde) — cartões de código pela toolbar **sem `pre`**: sobe do botão Copiar/Descarregar/Executar até ao ancestral mais pequeno com >200 chars (o cartão). Caso DeepSeek: o bloco é um componente próprio com numeração de linhas, não um `<pre>`.

## `platforms/dom.ts`

Ordem: XML no texto → selectores `codeBlock` da config → `pre code` genérico → fences. Em `cardMode` (raiz veio do fallback da toolbar, sem `pre`): `extractCodeFromCardText` primeiro — pura, tira do cabeçalho do innerText a etiqueta de linguagem e as linhas da toolbar (Copiar/Descarregar/Executar) e devolve o resto como código. **Nunca** aplicar cardMode a mensagens inteiras: apanhar prosa como código é o falso positivo a evitar. Linguagem: classe `language-*` primeiro, label de texto da config depois. Dedupe por texto quando dois selectores casam o mesmo node.

**`deepQuerySelectorAll` (2026-09-23, tarde).** `querySelectorAll` que desce aos `shadowRoot` — as UIs novas (DeepSeek) renderizam mensagens/código em custom elements com ShadowDOM. Corre só com o DOM estável (600 ms quieto), logo o custo da varredura é irrelevante.

## `platforms/generic.ts`

`makeConfigAdapter(cfg)` constrói o adapter a partir da config. Hosts vazios = casa com qualquer host (último recurso). `findAssistantMessages`, cadeia de recurso (afinada 2026-09-23 após o DeepSeek): selectores da config **com shadow roots** → `pre` com toolbar → **todos os `pre`** da página (melhor capturar a mais — o popup de aprovação filtra ruído — do que ficar mudo). `wrapComposer` usa o setter nativo do `<textarea>` porque o React ignora `el.value = …`.

## `platforms/registry.ts`

**Fonte da verdade: os `platforms/*.json`, embutidos no bundle** (import em tempo de build, não fetch). Config inválida (campo em falta) → não regista e o genérico cobre. Host desconhecido mas permitido no manifest → `fallbackAdapter` genérico. Site novo = JSON + host no manifest.

## `platforms/*.json`

Lidos em runtime desde 2026-09-23. Quando uma plataforma muda a UI, actualiza-se o JSON — o código fica. É exactamente o que partiu no DeepSeek: seletores hardcoded estilo ChatGPT (`article`) não casavam com `div.ds-markdown`; os JSON existiam mas nunca foram lidos.

**DeepSeek, DOM real (confirmado por HTML gravado 2026-09-23):** mensagem = `div.ds-assistant-message-main-content` / `div.ds-markdown`; bloco = `div.md-code-block` com banner (linguagem no 1º span) + botões `div[role='button']` "Copiar/Descarregar/Executar" + código num `<pre>` tokenizado com Prism **sem `<code>` filho** — por isso `codeBlock: ["pre code", "pre"]`; o `textContent` do `pre` aplaina os tokens para código limpo. Marcador `streaming` não existe nesta UI (0 ocorrências no HTML gravado).

## `platforms/monaco.ts` — extracção por React fibers (2026-09-23, Qwen)

Caso Qwen: o bloco de código é um **Monaco virtualizado** — só as linhas visíveis estão no DOM (`view-line`/`mtk*`, fora de ordem) e o corpo tem milhares de px de altura. Extrair pelo texto = código parcial e embaralhado: **nunca fazer**. O código completo vive nas props do componente React do editor. `extractMonacoBlocks(root)`: para cada `.monaco-editor`, sobe no DOM (≤10 níveis) até um nó com `__reactFiber$*` (o Monaco cria o elemento imperativamente, sem fiber próprio) e sobe a cadeia `return` (≤60 hops). **Busca por conteúdo (2026-09-23, após o Qwen falhar com nomes fixos):** o nome da prop varia por plataforma — uma linha visível (`view-line`, nbsp normalizado) é a agulha e o candidato tem de a conter, ser multiline e NÃO conter fences markdown (a mensagem inteira também contém a linha). Sem agulha: props conhecidas (`value`/`defaultValue`). Linguagem do `data-mode-id`. Nunca lança; [] em falha (o diagnóstico "0 blocos" dirá). Núcleo `codeFromFiberChain` é puro e testado.

## `content/main.ts`

Se não há adapter, o script sai. Observer no `body` → kick → scan da última mensagem. Stream a correr → não envia código.

**Guard de stream preso (2026-09-23, tarde).** Se o indicador de streaming estiver presente mas o DOM estiver parado >10 s (UI não limpou a classe), extrai à mesma e avisa "sinal de stream preso" — nunca esperar para sempre.

**Autodiagnóstico (2026-09-23, afinado no mesmo dia).** Nunca ficar mudo, mas também nunca gritar em falso: o aviso "0 mensagens" só dispara depois de um **Enter no compositor** (`awaitingAnswer`, janela de 60 s) — num chat vazio ("Como posso ajudar?") zero mensagens é o esperado e não avisa. Quando mensagens voltam a aparecer, o estado re-arma para a resposta seguinte. Este era o sintoma do DeepSeek: extensão instalada, zero capturas, zero explicação.

## Captura via clipboard (2026-09-23, universal)

A via **garantida** quando o DOM não chega (Monaco virtualizado, layouts A/B, UIs novas): o texto copiado — pelo botão "Copiar" do próprio bloco ou Ctrl+C. Duas vias complementares:

- **`inject/clipboard-hook.ts` (MAIN world)** — o botão "Copiar" das plataformas usa `navigator.clipboard.writeText()`, que **não dispara** o evento `copy`. Este script corre no mundo principal da página (2ª entrada de content_scripts, `"world": "MAIN"`, `document_start`, sem permissões novas) e embrulha `writeText`/`write`/`execCommand('copy')`, notificando via CustomEvent `cb:copy`. Contrato: nunca lançar para a página — copiar funciona sempre, com ou sem hook.
- **Evento `copy` nativo (Ctrl+C)** — durante o evento, `getData()` devolve vazio por spec; a fonte fiável é a `document.getSelection()` no momento.

O content script (`content/main.ts`, fora do gate do adapter — vale em qualquer host) filtra com `looksLikeCode` (`capture/parsers/language-guess.ts`: multilinha, ≥40 chars, pontuação/palavras-chave de código; prosa não passa) e envia bloco `source: "copy"` com `guessLanguage`. Mesma pipeline: dedup → jail → popup.

## `inject/hint-injector.ts`

Opt-in. Pede `// file: path/relativo.ext`. Não duplica se `[CodeBrowser]` já está no compositor.
