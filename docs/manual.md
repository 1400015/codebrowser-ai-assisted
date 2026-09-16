# Manual do CodeBrowser

Como o projecto foi feito, como está organizado, e o que cada ficheiro e bloco de código pretende atingir.

O texto anotado completo (origem, arquitectura, e cada módulo bloco a bloco) vive neste repositório à medida que for sincronizado. A cópia gerada nesta sessão é o PDF/Markdown entregues na conversa.

## Como o projecto nasceu

Três decisões antes de existir TypeScript:

1. Extensão MV3, não fork do Chromium.
2. Ollama só sugere `path` + `action`. Jail e escrita são determinísticos.
3. Nada é executado. Há um botão **Aprovar**.

Captura híbrida, nesta ordem:

```
DOM (pre > code) → fences markdown → tags XML opcionais
```

Ordem em que os ficheiros foram criados: tipos → parsers + testes → content script → service worker → workspace + planner → side panel → Corte A (barreira FS) → Corte B (persistência).

## Os quatro processos

```
chat (content script)
  → RAW_CAPTURE
service worker (hash + seenIds)
  → BLOCKS_READY
side panel (planner + Aprovar)
  → applyPlan
File System Access (pasta escolhida)
```

Só o `Workspace` escreve no disco. O worker nunca chama a File System Access API.

## Onde ler cada coisa

| Pasta | Papel |
|---|---|
| `src/types` | Contratos (`RawBlock`, `CodeBlock`, `IntegrationPlan`, mensagens) |
| `src/capture` | Watchdog 600 ms, SHA-256, parsers XML/fence/hint |
| `src/platforms` | Adapter genérico + registry de hosts |
| `src/content` | MutationObserver dentro do chat |
| `src/background` | Correio, dedup, histórico sem código |
| `src/orchestrator` | Jail, plano determinístico, Ollama, `applyPlan` |
| `src/workspace` | Barreira final + fila + memória de testes |
| `src/persist` | `seenIds` em session, histórico em local |
| `src/ui` | Side panel e popup de terminal |
| `tests` | Fronteiras: traversal, schema, `valid`, seen |

O walkthrough bloco-a-bloco de cada ficheiro está no manual longo (`docs/manual.md` completo / PDF).
