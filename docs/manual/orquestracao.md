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

## `planner.ts`

Sempre começa no determinístico. Qualquer excepção devolve o plano base. `confidence < 0.3` descarta o path do modelo. `valid` junta erros do base e do jail.

## `apply-plan.ts`

Único writer. `requestedPath` (o input) volta a `inspectPath`. Delete/overwrite pedem flags de confirmação. Testável sem DOM.
