# Registo de alterações

Cada alteração ao código fica registada aqui por data (mais recente primeiro), com ficheiros tocados e a razão. Estado "local" = ainda não enviado ao GitHub; passa a indicar o commit quando houver push.

---

## 2026-09-23 — Documentação das correcções (local)

**Ficheiros:** `docs/alteracoes.md` (novo), `docs/manual/orquestracao.md`, `docs/manual/escrita-ui.md`, comentários em `src/orchestrator/models.ts`, `src/orchestrator/settings.ts`, `src/ui/sidepanel.ts`, ligações no `README.md` e `docs/manual.md`.

**O quê e porquê.** Convenção: alterações sempre documentadas + notas explicativas junto aos blocos. Capítulo de orquestração recebeu `models.ts`, `settings.ts`, `openrouter.ts` (faltavam desde a funcionalidade OpenRouter) e o `planner.ts` foi actualizado para descrever a cascata real `primário → fallback → Ollama → determinístico`. Capítulo da UI documenta a sequência de preenchimento dos selects. Código recebeu comentários de contrato (o que cada bloco deve produzir, o que lança, o que nunca faz).

---

## 2026-09-22 — Correcção de modelos OpenRouter mortos + lista ao vivo (local)

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
