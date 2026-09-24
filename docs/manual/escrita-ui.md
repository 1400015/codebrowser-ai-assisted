# Workspace, UI e testes

Voltar ao [manual](../manual.md).

## `workspace/io.ts`

Quatro métodos. `applyPlan` e os testes falam com isto, não com a FSA.

## `queue.ts`

Serializa write/append/delete. O erro de uma operação não mata a fila.

## `workspace/handle-store.ts` (2026-09-23)

Handle da workspace em IndexedDB (`codebrowser-ws`/`handles`). Sem isto o handle vivia só na memória do side panel — fechar o painel perdia a pasta. Permissão persiste como "granted" ou volta a "prompt"; `requestPermission` só corre em clique (gesto). Todas as funções devolvem null/false em vez de lançar.

## `fs-access.ts`

Barreira final. `pick()` é o único `showDirectoryPicker` e **grava o handle em IndexedDB** (partilhado com o popup). `restoreSaved()`: "granted" (root activo) / "prompt" (precisa de clique → `resume()`) / "none". `walk` salta `.git` e `node_modules`. `readFile`: path inválido lança; em falta → `null`. Mutating ops passam pela fila.

## `memory.ts`

O mesmo contrato em RAM. É isto que prova `applyPlan(..., "../secret.txt")` sem Chrome.

## `capture-popup.html/ts` — popup imediato de captura (2026-09-23)

A UX pedida pelo utilizador: quando há código novo, **o popup abre sozinho** e pergunta Gravar / Intercalar (append) / Ignorar. Contrato:

- Aberto pelo service worker (`maybeOpenCapturePopup`), só com blocos novos (seen já filtrou repetidos); se já está aberto, foca-o (id de janela em `chrome.storage.session`, limpo em `onRemoved`).
- Desligável: checkbox "abrir automaticamente" → `chrome.storage.sync.capturePopupAuto = false`.
- Decisões persistem (`chrome.storage.local.handledBlocks`): popup reaberto não mostra o que já foi decidido, e o side panel remove o cartão ao receber `BLOCK_HANDLED` — sem dupla escrita.
- Gravar passa pelo MESMO pipeline: planBlock → applyPlan (jail repetido no requestedPath). Se a workspace está "prompt"/fechada, a permissão é pedida no clique de Gravar (gesto), nunca no arranque do popup.

## `sidepanel.ts`

Humano no meio. Cartões em DOM/`textContent`, não `innerHTML`. Aprovar disabled se `!plan.valid`. `approve()` só chama `applyPlan`. Diff contra o ficheiro existente ainda não existe (Corte C).

**Bloco — settings de AI.** No arranque, `loadAiSettings` (com migração de ids retirados) → preencher selects com a lista curada offline → repor valores guardados → `refreshModelList` em background. Os selects nunca ficam vazios: sucesso substitui as opções preservando a seleção (custom incluído, via `ensureOption`); falha registra aviso e mantém a curada. "Testar chave" chama `testOpenRouterKey` e mostra o resultado inline + no log.

**Bloco — workspace partilhada (2026-09-23).** `restoreSaved()` no arranque: "granted" → aberta com ficheiros contados; "prompt" → aviso "clicar Abrir para autorizar" (o clique faz `resume()`); "none" → `pick()` como sempre. Recebe `BLOCK_HANDLED` do popup e remove o cartão — sem dupla escrita.

## `overlay.ts`

Só o log. Não escreve.

## Testes

Não testam o Chrome. Fronteiras: traversal, `.env` ok / `.git` não, input manual, overwrite, schema Ollama, seen após “reload”, histórico sem `code`, defaults e migração de modelos, `fetchFreeModels` (filtro/ordem/erros) com fetch simulado, configs de plataformas (4 registadas, host certo, fallback genérico) e a matcher pura da toolbar (`isCopyDownloadLabel`). A parte DOM da toolbar fica para teste em browser — o fallback universal garante captura mesmo se falhar.
