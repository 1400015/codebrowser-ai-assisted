# Manual técnico do CodeBrowser

Este ficheiro é o guia de **manutenção**. Explica o que o código é obrigado a continuar a fazer, o que parte se mudares um módulo, e onde está o walkthrough bloco-a-bloco.

Walkthroughs detalhados (ficheiro a ficheiro, bloco a bloco):

- [Arranque, tipos, worker, persistência](manual/arranque.md)
- [Captura: parsers, platforms, content script](manual/captura.md)
- [Orquestração: jail, planner, Ollama, applyPlan](manual/orquestracao.md)
- [Workspace, UI e testes](manual/escrita-ui.md)

Arquitectura de produto: [`arquitetura.md`](arquitetura.md).

Versão descrita: `main` após Cortes A/B e a correcção do `readFile`.

---

## 1. O que este projecto é (e deixa de ser se ignorares isto)

CodeBrowser é uma extensão MV3 que:

1. observa o DOM de chats web;
2. extrai blocos de código;
3. propõe um path relativo ao root que o utilizador escolheu;
4. **só escreve depois de Aprovar**.

Não é um agente autónomo. Não executa o código capturado. Não usa o modelo como autoridade de segurança.

Três decisões que não se renegociam num PR de “melhoria”:

| Decisão | Consequência no código |
|---|---|
| Extensão, não fork | O service worker não chama `showDirectoryPicker`. |
| O modelo não escreve | `applyPlan` + `assertSafePath` são a autoridade. `confidence` é aviso, nunca autorização. |
| Nada corre sozinho | Não existe `run`, `eval`, nem escrita sem `plan.valid` e sem o botão. |

---

## 2. Fluxo contratual

```
content/main.ts scan()
  → RAW_CAPTURE { platform, url, RawBlock[] }
sw.ts onCapture()
  → jailPath → blockId → rememberSeen → HistoryEntry(status=captured)
  → BLOCKS_READY { CodeBlock[] }
sidepanel.ts renderBlock()
  → planBlock() → IntegrationPlan
  → cartão (Aprovar disabled se !plan.valid)
approve()
  → applyPlan(ws, block, plan, input.value)
       inspectPath(input)          // outra vez, não confiar no plano
       delete/overwrite confirms
       workspace.write/append/delete
         assertSafePath(path)      // última barreira
```

Se um PR acrescentar um segundo caminho de escrita, esse caminho **tem** de passar por `applyPlan`. Caso contrário o teste `../secret.txt` deixa de proteger o produto.

---

## 3. Invariantes de segurança

Quebrar qualquer uma destas linhas é regressão, mesmo que os testes de parser passem.

1. **Todo o path que chega ao disco passa por `assertSafePath` nessa chamada.** O input da UI é dados novos.
2. **`plan.valid === (plan.errors.length === 0)`.**
3. **`readFile` de path inválido lança. `readFile` de ficheiro em falta devolve `null`.**
4. **`.git` e `node_modules` não são destinos.** `.env` e `.github` são permitidos. Não rejeitar “qualquer segmento que comece por ponto”.
5. **O modelo não pode propor `delete`.**
6. **`confidence < 0.3` descarta o path do modelo.** Nunca `if (confidence > 0.8) write()`.
7. **Histórico em `chrome.storage.local` não guarda `code`.**
8. **O service worker não importa `fs-access.ts`.**

---

## 4. Funções contratuais

| Função | Contrato |
|---|---|
| `inspectPath(raw)` | Diagnóstico. Nunca substitui por fallback. |
| `jailPath(raw, fallback)` | Planeamento. Path sujo → fallback + `errors`. |
| `assertSafePath(raw)` | Escrita. Path sujo → throw. |
| `applyPlan(...)` | Único writer de produto. |
| `planBlock(...)` | Sempre devolve um plano. Ollama em baixo → determinístico. |
| `validateRoute(json)` | Sem delete; confidence clamp 0–1. |
| `rememberSeen(...)` | `false` = duplicado. |
| `extractBlocksFromElement(root)` | XML → `pre code` → fences. |

---

## 5. O que parte se mudares cada módulo

| Se alterares… | Podes partir… |
|---|---|
| `path-jail.ts` | traversal; escrita em `.env`; bloqueio de `.git` |
| `apply-plan.ts` | overwrite; teste do input manual |
| `fs-access.ts` `readFile` | inválido vs em falta |
| `planner.ts` `valid` | botão Aprovar com erros |
| `ollama.ts` schema | modelo a propor delete |
| `sw.ts` seen | duplicados depois do worker dormir |
| `content/main.ts` debounce | dezenas de captures por stream |
| `generic.ts` `wrapComposer` | hint invisível no ChatGPT |
| `manifest.json` hosts | captura a 0 |
| `vite.config.ts` nomes | extensão que não carrega |

---

## 6. Como alterar código neste repo

1. Abre o tipo em `src/types` que o ficheiro importa.
2. Este módulo *observa*, *decide* ou *escreve*? Só `applyPlan` + `Workspace` escrevem.
3. Path → teste em `path-jail.spec.ts` ou `apply-plan.spec.ts`.
4. DOM de um chat → selector/adapter, não o parser de fences.
5. Comentários só nos pontos de decisão.
