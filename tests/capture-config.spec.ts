import { describe, expect, it } from "vitest";
import { adapters, detectAdapter, fallbackAdapter } from "../src/platforms/registry";
import { isCopyDownloadLabel } from "../src/capture/toolbar";
import { extractCodeFromCardText } from "../src/platforms/dom";
import { codeFromFiberChain } from "../src/platforms/monaco";
import { guessLanguage, looksLikeCode } from "../src/capture/parsers/language-guess";

const doc = {} as Document;

describe("adapters dirigidos por platforms/*.json", () => {
  it("as 4 plataformas do repositório estão registadas", () => {
    expect(adapters.map((a) => a.id)).toEqual(
      expect.arrayContaining(["chatgpt", "grok", "qwen", "deepseek"]),
    );
  });

  it("detectAdapter casa o host da config certa", () => {
    expect(detectAdapter(new URL("https://chat.deepseek.com/a/b"), doc)?.id).toBe("deepseek");
    expect(detectAdapter(new URL("https://chatgpt.com/c/1"), doc)?.id).toBe("chatgpt");
    expect(detectAdapter(new URL("https://chat.qwen.ai/s"), doc)?.id).toBe("qwen");
    expect(detectAdapter(new URL("https://grok.com/chat"), doc)?.id).toBe("grok");
  });

  it("host desconhecido cai no adapter genérico (fallback da toolbar)", () => {
    expect(detectAdapter(new URL("https://outro-chat.example.com"), doc)?.id).toBe("generic");
  });

  it("subdomínios contam como host da plataforma", () => {
    expect(detectAdapter(new URL("https://chat.deepseek.com"), doc)?.id).toBe("deepseek");
  });

  it("DeepSeek extrai pre SEM <code> filho (DOM real 2026-09-23: <pre><span class='token'>)", async () => {
    // O DOM real do DeepSeek tokeniza com Prism directamente no <pre>. Sem o
    // selector "pre", a captura fica muda (mensagem encontrada, 0 blocos).
    const cfg = (await import("../platforms/deepseek.json")).default;
    expect(cfg.codeBlock).toContain("pre");
    expect(cfg.assistant).toContain("div.ds-assistant-message-main-content");
    expect(cfg.languageLabel).toContain("div.md-code-block-banner span");
  });

  it("fallbackAdapter casa qualquer host mas devolve null nenhum", () => {
    // fallbackAdapter é o último recurso; nunca devolve null quando chamado directo
    expect(fallbackAdapter.match(new URL("https://qualquer.site"), doc)).toBe(true);
  });
});

describe("heurística da toolbar de código (copiar/descarregar)", () => {
  it("reconhece sinais pt e en", () => {
    expect(isCopyDownloadLabel("Copy code")).toBe(true);
    expect(isCopyDownloadLabel("Copiar código")).toBe(true);
    expect(isCopyDownloadLabel("Download")).toBe(true);
    expect(isCopyDownloadLabel("code-block-copy")).toBe(true);
    expect(isCopyDownloadLabel("Copiar para a área de transferência")).toBe(true);
  });

  it("rejeita textos que não são controlos de bloco", () => {
    expect(isCopyDownloadLabel("Enviar mensagem")).toBe(false);
    expect(isCopyDownloadLabel("")).toBe(false);
    expect(isCopyDownloadLabel("o")).toBe(false); // < 2 chars
    expect(isCopyDownloadLabel("ab".repeat(40))).toBe(false); // > 60 chars
  });

  it("classe CSS e aria-label contam como sinal", () => {
    expect(isCopyDownloadLabel("ds-copy-button")).toBe(true);
    expect(isCopyDownloadLabel("aria:clipboard")).toBe(true);
  });

  it("reconhece etiquetas chinesas e ícones só-svg (caso DeepSeek)", () => {
    expect(isCopyDownloadLabel("复制")).toBe(true);
    expect(isCopyDownloadLabel("复制代码")).toBe(true);
    expect(isCopyDownloadLabel("下载")).toBe(true);
    expect(isCopyDownloadLabel("#icon-copy")).toBe(true);
    expect(isCopyDownloadLabel("#icon-check")).toBe(false);
  });
});

describe("extracção de cartão de código por texto (cardMode, caso DeepSeek)", () => {
  it("tira etiqueta de linguagem + linhas da toolbar e devolve o código", () => {
    const text = [
      "html",
      "Copiar",
      "Descarregar",
      "Executar",
      "<!DOCTYPE html>",
      "<html lang=\"pt\">",
      "</html>",
    ].join("\n");
    const out = extractCodeFromCardText(text);
    expect(out?.language).toBe("html");
    expect(out?.code.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out?.code).not.toContain("Copiar");
  });

  it("funciona sem etiqueta de linguagem e com linhas vazias", () => {
    const out = extractCodeFromCardText("\nCopiar\n\nprint('olá')\n");
    expect(out?.language).toBeUndefined();
    expect(out?.code).toBe("print('olá')");
  });

  it("devolve null quando não sobra código", () => {
    expect(extractCodeFromCardText("html\nCopiar\nDescarregar")).toBeNull();
    expect(extractCodeFromCardText("")).toBeNull();
  });

  it("não confunde etiqueta com pontuação (prosa fica intacta)", () => {
    const out = extractCodeFromCardText("Claro! Aqui está:\nconst x = 1;");
    expect(out?.language).toBeUndefined();
    expect(out?.code.startsWith("Claro!")).toBe(true);
  });
});

describe("extracção Monaco por React fibers (caso Qwen)", () => {
  const CODE = "from docx import Document\ndoc = Document()\n";
  const NEEDLE = "from docx import Document";

  it("sem agulha: sobe a cadeia e devolve props.value multiline", () => {
    const fiber = {
      memoizedProps: { className: "monaco-editor" },
      return: { memoizedProps: { value: CODE, language: "python" } },
    };
    expect(codeFromFiberChain(fiber)).toBe(CODE);
  });

  it("com agulha: acha a prop pelo CONTEÚDO mesmo com outro nome", () => {
    // O Qwen não usa `value` — a prop do código tem outro nome.
    const fiber = { memoizedProps: { code: CODE, "data-x": 1 } };
    expect(codeFromFiberChain(fiber, 60, NEEDLE)).toBe(CODE);
  });

  it("com agulha: rejeita o markdown da mensagem (tem fences) e segue acima", () => {
    const markdown = `Aqui está:\n\`\`\`python\n${CODE}\`\`\`\nfim.`;
    const fiber = {
      memoizedProps: { content: markdown }, // nível 1: mensagem inteira — rejeitar
      return: { memoizedProps: { modelCode: CODE } }, // nível 2: código puro
    };
    expect(codeFromFiberChain(fiber, 60, NEEDLE)).toBe(CODE);
  });

  it("com agulha: rejeita candidatos curtos demais", () => {
    expect(codeFromFiberChain({ memoizedProps: { x: NEEDLE } }, 60, NEEDLE)).toBeNull();
  });

  it("sem agulha e sem props de código: null; cadeia infinita termina", () => {
    expect(codeFromFiberChain(null)).toBeNull();
    const loop: Record<string, unknown> = {};
    loop.return = loop;
    expect(codeFromFiberChain(loop)).toBeNull();
  });

  it("Qwen usa o contentor certo e não extrai Monaco pelo texto", async () => {
    const cfg = (await import("../platforms/qwen.json")).default;
    expect(cfg.assistant).toContain("div.message-hoc-container");
    // pre do Qwen é Monaco virtualizado — extrair pelo texto daria código
    // parcial e embaralhado; por isso NÃO está na lista codeBlock.
    expect(cfg.codeBlock).not.toContain("pre");
  });
});

describe("captura via evento copy (universal, caso Qwen A/B)", () => {
  const PY = "#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\nprint('olá mundo')\n";

  it("looksLikeCode aceita código e rejeita prosa", () => {
    expect(looksLikeCode(PY)).toBe(true);
    expect(looksLikeCode("const x = 1;\nconst y = 2;\nconst z = x + y;\n")).toBe(true);
    const prosa =
      "Este é um parágrafo de prosa em português sobre o estado do tempo em Portugal continental hoje.";
    expect(looksLikeCode(prosa)).toBe(false);
    expect(looksLikeCode("linha única sem quebras")).toBe(false);
    expect(looksLikeCode("curto\nmas\npouco")).toBe(false);
  });

  it("guessLanguage identifica python, html e javascript; fallback text", () => {
    expect(guessLanguage(PY)).toBe("python");
    expect(guessLanguage("<!DOCTYPE html>\n<html lang=\"pt\">\n")).toBe("html");
    expect(guessLanguage("const x = () => {\n  return 1;\n};\n")).toBe("javascript");
    expect(guessLanguage("from docx import Document\ndoc = Document()\n")).toBe("python");
    expect(guessLanguage("isto não é código reconhecível\nsegunda linha\n")).toBe("text");
  });
});
