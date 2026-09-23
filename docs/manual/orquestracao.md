# Orquestração

Voltar ao [manual](../manual.md).

## `path-jail.ts`

**Objectivo.** Um único sítio que decide se um path é escrevível.

**Bloco — constantes.** Absolutos (`/`, `C:\`, `~`). Directórios bloqueados (`.git`, `node_modules`). Nomes Windows. Limites 240 / 80. Não bloquear segmentos que começam por `.` — senão `.env` morre.

**Bloco — `inspectPath`.** Diagnóstico: normaliza e lista erros sem fallback.

**Bloco — `jailPath(raw, fallback)`.** Planeamento. Path sujo → fallback + erros. O plano fica inválido mas apresentável.

**Bloco — `assertSafePath`.** Escrita. Path sujo → throw. Sem fallback silencioso.

**Bloco — `fallbackName`.** `captured/snippet.ts` conforme a língua.

## `deterministic.ts`

Plano que funciona com o Ollama desligado. `create`+existe → `update`. `valid` = `jailed.errors.length === 0`.

## `ollama.ts`

Pede JSON pequenino e não acredita nele. 20k/12k chars, 15 s, `validateRoute` recusa `delete`, clamp 0–1. `confidence` ausente vira 0 e o planner ignora o modelo.

## `models.ts`

Catálogo de modelos `:free` do OpenRouter. A oferta muda com frequência — nunca assumir que um id vive para sempre.

**Bloco — `FREE_MODELS`.** Lista curada para exibir sem rede. Primeiro elemento é o primário sugerido. Contextos reais da API (convenção binária, 1K = 1024).

**Bloco — `RETIRED_MODEL_IDS` + `normalizeModelId`.** Migração: ids que já saíram da oferta `:free` re-mapeiam para os defaults ao carregar settings. Contrato: devolve sempre id não-vazio, nunca lança; ids desconhecidos passam (custom).

**Bloco — `fetchFreeModels`.** Lista ao vivo, `GET /models` público sem chave. Produz só `:free`, ordenado alfabeticamente, label sem "(free)". Lança em HTTP/rede/lista vazia — o chamador mantém a curada.

**Bloco — `humanizeContext`.** 32768 → "32K", 1048576 → "1M"; sem valor → "?".

## `settings.ts`

**Bloco — `normalizeSettings`.** Nunca lança; devolve `AiSettings` completo. É aqui que settings antigas do `chrome.storage.sync` se corrigem (migração de ids retirados via `normalizeModelId`).

**Bloco — `loadAiSettings` / `saveAiSettings`.** Sem `chrome` (testes) → defaults. Modelos em `sync`, chave **só** em `local`. Falha de storage → defaults, não crash.

## `openrouter.ts`

Mesmo contrato de saída do `ollama.ts` (`RouteResult` via `validateRoute`), 45 s. `testOpenRouterKey` usa `GET /auth/key` (sem gastar tokens) e devolve a etiqueta da conta. Erros HTTP trazem os primeiros 200 chars do corpo para o log.

## `planner.ts`

Sempre começa no plano determinístico como base. Com chave + modelo configurados, a ordem é: **OpenRouter primário → OpenRouter fallback → Ollama → determinístico**. Cada degrau registra aviso explicando a falha. Modo `off` salta tudo. Sem chave, começa no Ollama. `confidence < 0.3` descarta o path do modelo. Qualquer excepção devolve o plano base.

## `apply-plan.ts`

Único writer. `requestedPath` (o input) volta a `inspectPath`. Delete/overwrite pedem flags de confirmação. Testável sem DOM.
