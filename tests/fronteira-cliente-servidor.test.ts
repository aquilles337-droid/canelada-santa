import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fronteira entre servidor e cliente.
 *
 * Quando um componente de SERVIDOR importa um valor de um módulo marcado com
 * "use client", ele não recebe o valor: recebe um marcador de referência. Com
 * componentes isso funciona — é assim que o React atravessa a fronteira. Com
 * dado comum, não: o array vira um objeto que não é array, e o erro só
 * aparece em produção, na hora de renderizar.
 *
 * Foi exatamente o que aconteceu com a barra de navegação: o layout fazia
 * `[...NAV_JOGADOR]` e quebrava com "is not iterable". Passou pelo
 * `next build` sem um aviso sequer.
 *
 * A regra que este teste cobra: de um módulo de cliente, o servidor só pode
 * importar COMPONENTES — identificadores em PascalCase. Qualquer outra coisa
 * (lista, constante, função auxiliar) precisa morar num módulo neutro.
 */

const RAIZ = path.resolve(import.meta.dirname, "..");
const FONTES = path.join(RAIZ, "src");

function arquivosDeCodigo(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = path.join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeCodigo(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

function ehModuloDeCliente(caminho: string): boolean {
  const conteudo = readFileSync(caminho, "utf8").trimStart();
  return conteudo.startsWith('"use client"') || conteudo.startsWith("'use client'");
}

/** Resolve "@/components/nav/X" para o arquivo real, se existir. */
function resolverImport(especificador: string): string | null {
  if (!especificador.startsWith("@/")) return null;

  const base = path.join(FONTES, especificador.slice(2));
  for (const tentativa of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.ts")]) {
    if (existsSync(tentativa)) return tentativa;
  }
  return null;
}

const ehComponente = (nome: string) => /^[A-Z][A-Za-z0-9]*$/.test(nome);

describe("fronteira entre servidor e cliente", () => {
  it("o servidor só importa componentes de módulos de cliente", () => {
    const problemas: string[] = [];

    for (const arquivo of arquivosDeCodigo(FONTES)) {
      if (ehModuloDeCliente(arquivo)) continue;

      const conteudo = readFileSync(arquivo, "utf8");
      const importes = conteudo.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g);

      for (const [, listaBruta, especificador] of importes) {
        const alvo = resolverImport(especificador ?? "");
        if (!alvo || !ehModuloDeCliente(alvo)) continue;

        const nomes = (listaBruta ?? "")
          .split(",")
          .map((parte) => parte.trim())
          // `type X` é apagado na compilação: não atravessa nada.
          .filter((parte) => parte.length > 0 && !parte.startsWith("type "))
          .map((parte) => (parte.split(/\s+as\s+/)[0] ?? "").trim());

        for (const nome of nomes) {
          if (ehComponente(nome)) continue;

          problemas.push(
            `${path.relative(RAIZ, arquivo)} importa "${nome}" de ${especificador}, ` +
              `que é um módulo de cliente. Mova esse valor para um módulo neutro.`,
          );
        }
      }
    }

    expect(problemas).toEqual([]);
  });
});
