# CodeBrowser — Arquitectura técnica v0

**Data:** 2026-09-16  
**Produto:** extensão Chromium MV3. Não é um fork do Chromium. Host recomendado: Chrome ou BrowserOS.

## Decisões

| Tema | v0 |
|---|---|
| Produto | Extensão Manifest V3 |
| Captura | Híbrida: DOM → fences markdown → XML opcional |
| Modelo local | `qwen2.5-coder:7b` (default); `qwen3-coder:30b` se houver VRAM |
| Papel do modelo | Escolher path + action. Não valida sintaxe |
| Filesystem | Side panel (`showDirectoryPicker`). Nunca no service worker |
| Execução | Proibida |
| Plataformas | ChatGPT, Grok, Qwen web, DeepSeek + genérico |

## Marcadores XML

Exequíveis como contrato *preferido*, não como único mecanismo. ChatGPT/Grok/Qwen ignoram system prompts injectados com frequência. A captura primária é `pre > code` e fences. Injeção opt-in de **uma linha visível**:

```
[CodeBrowser] Se gerares ficheiros, indica o caminho na primeira linha: // file: path/relativo.ext
```

IDs de bloco = SHA-256 de `(path, action, code)`. Nunca `Date.now()`.

## Fluxo

```
chat web → content script (debounce 600 ms)
        → service worker (hash + dedup)
        → side panel (plano determinístico + Ollama opcional)
        → Aprovar → File System Access escreve
```

O terminal de actividade vive no dock do side panel e num popup de canto (`chrome.windows.create`). É um log estruturado, não um PTY.

## Segurança

- Jail de path: rejeitar `..`, absolutos, `~`
- Sem `run`, sem shell
- `delete` pede confirmação extra
- Escrever exige clique em Aprovar

## Fases

0. Extensão + terminal + picker (este commit)
1. Fixtures HTML reais por site
2. Tree-sitter + diff Monaco
3. Hint injector ligado ao toggle
4. Git opcional
