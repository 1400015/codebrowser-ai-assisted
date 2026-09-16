# Arranque, tipos, worker e persistência

Voltar ao [manual](../manual.md).

## `manifest.json`

MV3. Permissões: `storage`, `sidePanel`, `activeTab`, `windows`. Hosts só dos chats + `127.0.0.1:11434`. Worker `sw.js`. Content script em `document_idle`.

## `vite.config.ts` / `postbuild.mjs`

Quatro entradas. `content.js` e `sw.js` **sem hash** — o manifest aponta para esses nomes. O postbuild copia o manifest para `dist/` e ajusta paths.

## `src/types`

- `FileAction` — só quatro verbos.
- `RawBlock` → `CodeBlock` (ganha id + plataforma).
- `IntegrationPlan.valid` ⇔ `errors.length === 0`.
- `HistoryEntry` sem `code`.
- `ExtensionMessage` é união discriminada: tipo novo fora daqui parte o TypeScript de propósito.
- `PlatformAdapter` é o contrato de um site.

## `sw.ts`

Correio, não disco. `onMessage` devolve `true` para o async. `onCapture`: jail → hash → `rememberSeen` → histórico sem código → session dos últimos 100 blocos.

## `src/persist`

`KeyValueStore` para testar sem Chrome. `rememberSeen` devolve false se já vimos o id (o Set em memória morria com o worker). `appendHistory` guarda só metadados, últimos 200.
