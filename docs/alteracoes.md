# Registo de alterações

Cada alteração ao código fica registada aqui por data (mais recente primeiro), com ficheiros tocados e a razão. Estado "local" = ainda não enviado ao GitHub; passa a indicar o commit quando houver push.

---

## 2026-09-23 — Popup imediato de captura + fix do DeepSeek (commit `f165ca6`, validado em DeepSeek e Qwen a 2026-09-24)

**Ficheiros:** `src/capture/toolbar.ts` (novo), `src/platforms/registry.ts`, `src/platforms/generic.ts`, `src/platforms/dom.ts`, `src/content/main.ts`, `src/workspace/handle-store.ts` (novo), `src/workspace/fs-access.ts`, `src/background/sw.ts`, `src/ui/capture-popup.html` (novo), `src/ui/capture-popup.ts` (novo), `src/ui/sidepanel.ts`, `src/types/platform.ts`, `src/types/messages.ts`, `vite.config.ts`, `tsconfig.json` (`resolveJsonModule`), `tests/capture-config.spec.ts` (novo), `README.md`, `docs/manual/captura.md`, `docs/manual/escrita-ui.md`.

**Adenda (mesmo dia, teste no Qwen).** O screenshot do utilizador mostrou o autodiagnóstico a disparar num **chat vazio** ("Como posso ajudar?" → "0 mensagens: selectores desactualizados") — falso positivo: num chat sem conversa, zero mensagens é o normal. Correcção em `content/main.ts`: o aviso só soa depois de um Enter no compositor (`awaitingAnswer`, janela de 60 s) e re-arma quando mensagens aparecem, para a resposta seguinte falhada voltar a avisar.

**Adenda 2 (mesmo dia, teste no DeepSeek).** O aviso "resposta pedida mas 0 mensagens" disparou **a sério** no DeepSeek: content script activo, Enter detectado, mas nem `div.ds-markdown` nem o fallback da toolbar encontraram nada — a UI do DeepSeek mudou (provável shadow DOM e/ou toolbar só-ícones). Reforço: (1) `deepQuerySelectorAll` atravessa shadow roots (novo em `platforms/dom.ts`, usado nos selectores de mensagem, extração e toolbar); (2) toolbar reconhece ícones só-SVG (`href`/`xlink:href`/classe) e etiquetas chinesas (复制/下载; mínimo de 2 chars); (3) último recurso no `findAssistantMessages`: **todos os `pre`** da página quando mais nada casa. Extra: guarda contra sinal de stream preso (indicador presente + DOM parado >10 s → extrai e avisa).

**Adenda 3 (mesmo dia, screenshot do DeepSeek com toolbar visível).** O bloco do DeepSeek tem toolbar **"Copiar | Descarregar | Executar"** bem visível e nada foi capturado. Duas frentes: (1) causa provável de metade dos casos — **recarregar a extensão não reinjeta content scripts em tabs já abertas**; a página do chat tem de ser recarregada (F5) depois do reload da extensão; (2) robustez real — o "bloco" do DeepSeek é um componente próprio com numeração de linhas, possivelmente sem `<pre>`: novo `findToolbarCodeContainers` (sobe do botão Copiar/Descarregar/Executar até ao cartão de código, >200 chars, ≤6 níveis) e extracção `cardMode` (`extractCodeFromCardText`, pura e testada: tira a etiqueta de linguagem e as linhas da toolbar do cabeçalho do innerText). Sinal "executar" adicionado à matcher. Diagnóstico do aviso agora traz contagens profundas (pre, code, botões copiar, shadow roots) — a próxima falha auto-explica-se sem DevTools. `sw.ts` persiste ACTIVITY do content script (linhas de arranque/diagnóstico sobrevivem a reabrir o painel).

**Adenda 4 (mesmo dia, análise do HTML gravado pelo utilizador).** O utilizador gravou a página do DeepSeek (HTML) e a análise fechou o caso: (1) o contentor de mensagem é mesmo `div.ds-markdown` (e o mais preciso `div.ds-assistant-message-main-content`) — os selectores estavam certos; (2) **a causa real**: o código está num `<pre>` tokenizado com Prism (`<pre><span class="token">…`) **sem nenhum `<code>` filho** — o selector `pre code` nunca casava, a mensagem era encontrada mas extraía 0 blocos em silêncio; (3) a toolbar é `div[role='button']` com texto "Copiar/Descarregar/Executar" e a linguagem vem do primeiro span do banner (`span` dentro de `div.md-code-block-banner`). Correcções: `deepseek.json` com `codeBlock: ["pre code", "pre"]` (textContent do `pre` aplaina os tokens), `languageLabel` pelo banner, assistant com o contentor preciso; novo diagnóstico "mensagem encontrada mas 0 blocos" (o caso que faltava); teste de regressão que trava a reversão do JSON. Verificação: verify verde (57/57).

**Adenda 5 (mesmo dia, análise do HTML gravado do Qwen).** O Qwen é um caso oposto ao DeepSeek: o bloco de código é um **Monaco (VS Code) virtualizado** — só as linhas visíveis existem no DOM (`view-line`/`mtk*`, fora de ordem visual; o teu bloco começava na linha 201), por isso extrair pelo texto daria código parcial e embaralhado. O código completo vive nas **props do componente React** que monta o editor. Novo `src/platforms/monaco.ts`: sobe da árvore DOM até um nó com fiber React (`__reactFiber$*` — o `.monaco-editor` é criado imperativamente, sem fiber próprio), percorre a cadeia `return` e devolve a primeira prop de código multiline. Linguagem do `data-mode-id`. Integrado em `dom.ts` ANTES dos selectores; `qwen.json` actualizado com o contentor real (`div.message-hoc-container`) e **sem** `pre` no codeBlock (extrair o Monaco pelo texto seria errado). O cabeçalho do bloco (`div.qwen-markdown-code-header`) e os ícones `#qwpcicon-copy/download` confirmados no HTML gravado. Verificação: verify verde (61/61, +4 testes de fiber).

**Adenda 6 (mesmo dia, teste real: DeepSeek OK, Qwen falhou).** DeepSeek capturou (popup com os 2 blocos; os 429 do `laguna-s-2.1:free` são o fallback a funcionar). O Qwen disparou o diagnóstico "mensagem encontrada mas 0 blocos": o contentor casa, mas a extracção por fibers não achou a prop `value` — **o Qwen guarda o código numa prop com outro nome** (confirmado: o HTML gravado não tem o código em lado nenhum, só nas props React em runtime). Nova estratégia no `monaco.ts`: busca **por conteúdo** — uma linha visível do editor (`view-line`, nbsp normalizado) serve de agulha e a extracção procura a prop string que a contém, com guardas: tem de ser multiline e **não** pode conter fences markdown (senão apanha a mensagem inteira, que também contém a linha). Sem agulha, mantém o caminho rápido por nomes conhecidos (`value`/`defaultValue`). Bónus: linguagem do DeepSeek agora também lida do banner no contentor do próprio `pre` (antes saía "text"). Verificação: verify verde (63/63).

**Adenda 7 (mesmo dia, Qwen continua a falhar → via universal).** O Qwen falha mesmo com a busca por conteúdo (o screenshot revelou ainda o modo comparação A/B "Resposta 1/Resposta 2", que muda o layout outra vez). Decisão: parar de depender de internals do React e usar a via **garantida** — captura universal via clipboard. O content script (`content/main.ts`, fora do gate do adapter — vale em qualquer host) filtra com `looksLikeCode` (multilinha, ≥40 chars, pontuação/palavras-chave; prosa não passa) e envia como bloco `source: "copy"` com linguagem via `guessLanguage` (novo `capture/parsers/language-guess.ts`: python/html/js/java/c/csharp/go/text). Mesma pipeline: dedup → jail → popup → aprovação. +2 testes. Bónus: corrigido o spam do diagnóstico "0 blocos" (só re-arma quando há blocos — antes disparava a cada scan estável). Verificação: verify verde (65/65).

**Adenda 8 (mesmo dia, o clique em Copiar continuou mudo — causa encontrada).** O teste real do utilizador revelou DOIS erros na via do evento copy: (1) o botão "Copiar" do Qwen usa `navigator.clipboard.writeText()`, que **não dispara** o evento `copy` — o listener nunca acordava; (2) durante o evento `copy`, `clipboardData.getData()` devolve vazio por especificação (modo copy só aceita `setData`) — duplo golpe. Correcção definitiva: novo `src/inject/clipboard-hook.ts` a correr no **MAIN world** (2ª entrada de content_scripts no manifest, `"world": "MAIN"`, `document_start`, sem permissões novas): embrulha `navigator.clipboard.writeText`/`write` e `document.execCommand('copy')`, e notifica o content script via CustomEvent `cb:copy` na árvore DOM partilhada. O content script passou a: escutar `cb:copy` (via do botão) e, no evento `copy` nativo (Ctrl+C), ler a **selecção** em vez do clipboardData. Contrato do hook: nunca lançar para a página — copiar funciona sempre, com ou sem hook. Verificação: verify verde (65/65) e manifest do dist com as duas entradas confirmado.

**Validação (2026-09-24, screenshot do utilizador): QWEN A CAPTURAR.** Popup "Código capturado" abriu sozinho com o bloco completo: `captured/snippet.html · html · copy`, linguagem detectada pelo `guessLanguage`, path gerado correctamente, side panel sincronizado. Log: `parse qwen captured/snippet.html · html · copy` → `plan create captured/snippet.html (determinístico)`. DeepSeek validado no dia anterior (captura por DOM). Ambas as plataformas OK. Refinamentos pós-validação no dist: botão do popup passou a "Fechar" (o "Abrir painel" não abria painel nenhum), README actualizado com a captura via clipboard.

**Problema.** No DeepSeek nada era capturado: o adapter genérico usava selectores hardcoded estilo ChatGPT (`article`, `[data-message-author-role='assistant']`) e o DeepSeek renderiza mensagens como `div.ds-markdown`. Os `platforms/*.json` com os selectores certos existiam mas nunca eram lidos.

**O quê.**

1. **Fix DeepSeek — adapters dirigidos por config.** `registry.ts` agora embute os `platforms/*.json` (import de build) e valida-os; `generic.ts` (`makeConfigAdapter`) usa os selectores da config com fallbacks. `dom.ts` extrai por `codeBlock` da config, com linguagem pela classe `language-*` e depois pelo label da config.
2. **Heurística da toolbar (ideia do utilizador: "o código tem botões de download e cópia — o nosso devia capturar isso").** `capture/toolbar.ts`: blocos reconhecidos pelos botões copiar/descarregar que os chats põem em cada bloco. `findToolbarCodeBlocks` é o fallback universal quando os selectores falham — mesmo com a UI redesenhada, os blocos com botão de copiar continuam a ser capturados.
3. **Popup imediato (a UX pedida).** Quando há blocos novos, `maybeOpenCapturePopup` (sw) abre `src/ui/capture-popup.html` (ou foca-o se já aberto; desligável com "abrir automaticamente"). O popup mostra o código, path editável e acção (create / update / intercalar-append), e Gravar passa pelo mesmo pipeline planBlock → applyPlan (jail incluído). Decisões persistem em `handledBlocks`; o side panel recebe `BLOCK_HANDLED` e remove o cartão — sem dupla escrita.
4. **Workspace partilhada.** Handle da pasta em IndexedDB (`workspace/handle-store.ts`); `pick()` grava, `restoreSaved()`/`resume()` restauram (permissão pedida só em clique — gesto). Side panel e popup usam a mesma pasta.
5. **Autodiagnóstico.** Content script com adapter activo e 0 mensagens → um aviso no log ("actualiza platforms/*.json") em vez de silêncio total — o sintoma original do DeepSeek.

**Limitações.** Não foi possível testar contra o DOM real do DeepSeek (login necessário). Se os selectores do `deepseek.json` não casarem com a UI actual, o fallback da toolbar e o aviso de autodiagnóstico entram em ação; ajuste fino = editar o JSON.

**Verificação.** `npm run verify` verde: typecheck, 51/51 testes (+8: configs de plataformas, fallback genérico, matcher da toolbar), build com o popup incluído.

---

## 2026-09-23 — Documentação das correcções (commit `8ee03d8`)

**Ficheiros:** `docs/alteracoes.md` (novo), `docs/manual/orquestracao.md`, `docs/manual/escrita-ui.md`, comentários em `src/orchestrator/models.ts`, `src/orchestrator/settings.ts`, `src/ui/sidepanel.ts`, ligações no `README.md` e `docs/manual.md`.

**O quê e porquê.** Convenção: alterações sempre documentadas + notas explicativas junto aos blocos. Capítulo de orquestração recebeu `models.ts`, `settings.ts`, `openrouter.ts` (faltavam desde a funcionalidade OpenRouter) e o `planner.ts` foi actualizado para descrever a cascata real `primário → fallback → Ollama → determinístico`. Capítulo da UI documenta a sequência de preenchimento dos selects. Código recebeu comentários de contrato (o que cada bloco deve produzir, o que lança, o que nunca faz).

---

## 2026-09-22 — Correcção de modelos OpenRouter mortos + lista ao vivo (commit `8ee03d8`)

**Ficheiros:** `src/orchestrator/models.ts`, `src/orchestrator/settings.ts`, `src/ui/sidepanel.ts`, `tests/ai-models.spec.ts`, `README.md`, `package.json` (só `allowScripts` do esbuild, gerado pelo npm).

**Problema.** Ao testar a 2026-09-21, os planos caíam sempre no determinístico. Causa confirmada contra a API do OpenRouter: o fallback default `openai/gpt-oss-120b:free` e a opção `inclusionai/ling-3.0-flash:free` já não existem na oferta `:free` (restam 21 modelos). Com ambos mortos, a cadeia `primário → fallback → Ollama → determinístico` acabava sempre no plano local.

**O quê.**

1. `models.ts` — fallback default passa a `z-ai/glm-5.2:free`; lista curada reconstruída com 9 modelos `:free` verificados na API, com contextos reais; `RETIRED_MODEL_IDS` migra ids mortos guardados em storage para os defaults ao carregar; novo `fetchFreeModels` (lista `:free` ao vivo, ordenada, sem chave) e `humanizeContext`.
2. `sidepanel.ts` — usa as constantes de default (sem literais duplicados); ao abrir, os selects preenchem com a lista curada e são actualizados em background com a lista ao vivo, preservando a selecção (custom incluído); falha de rede mantém a curada e registra aviso no log.
3. `settings.ts` — a migração aplica-se em `normalizeSettings` (storage.sync + storage.local).
4. Testes — 38 → 43: defaults na lista curada, migração de ids retirados, `humanizeContext`, `fetchFreeModels` (filtro, ordem, HTTP 500, lista vazia) com fetch simulado.

**Verificação.** `npm run verify` verde: typecheck limpo, 43/43 testes, build completo.

---

## 2026-09-21 — (commit `58fabce`, já no GitHub)

Funcionalidade OpenRouter: modelos gratuitos configuráveis, fallback, modo off, testar chave. Foi testada neste dia e revelou o problema corrigido acima.
