# Workspace, UI e testes

Voltar ao [manual](../manual.md).

## `workspace/io.ts`

Quatro métodos. `applyPlan` e os testes falam com isto, não com a FSA.

## `queue.ts`

Serializa write/append/delete. O erro de uma operação não mata a fila.

## `fs-access.ts`

Barreira final. `pick()` é o único `showDirectoryPicker`. `walk` salta `.git` e `node_modules`. `readFile`: path inválido lança; em falta → `null`. Mutating ops passam pela fila.

## `memory.ts`

O mesmo contrato em RAM. É isto que prova `applyPlan(..., "../secret.txt")` sem Chrome.

## `sidepanel.ts`

Humano no meio. Cartões em DOM/`textContent`, não `innerHTML`. Aprovar disabled se `!plan.valid`. `approve()` só chama `applyPlan`. Diff contra o ficheiro existente ainda não existe (Corte C).

## `overlay.ts`

Só o log. Não escreve.

## Testes

Não testam o Chrome. Fronteiras: traversal, `.env` ok / `.git` não, input manual, overwrite, schema Ollama, seen após “reload”, histórico sem `code`.
