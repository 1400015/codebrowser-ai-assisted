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

## `platforms/dom.ts`

Ordem: XML no texto → `pre code` → fences. Selectors em lista para sobreviver a class names novos.

## `platforms/generic.ts`

Um adapter para os quatro sites. `wrapComposer` usa o setter nativo do `<textarea>` porque o React ignora `el.value = …`.

## `platforms/registry.ts`

Tabela hostname → adapter. Site novo = uma linha + JSON + host no manifest.

## `platforms/*.json`

Ainda não são lidos em runtime. Existem para o dia em que o DOM mudar sem reescrever o motor.

## `content/main.ts`

Se não há adapter, o script sai. Observer no `body` → kick → scan da última mensagem. Stream a correr → não envia código.

## `inject/hint-injector.ts`

Opt-in. Pede `// file: path/relativo.ext`. Não duplica se `[CodeBrowser]` já está no compositor.
