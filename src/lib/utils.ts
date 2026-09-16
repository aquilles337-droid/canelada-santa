import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind resolvendo conflitos. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}

/** Espera — usado em reprocessamentos com recuo exponencial. */
export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gerador pseudoaleatorio deterministico (mulberry32). */
export function geradorAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha uma copia da lista de forma deterministica. */
export function embaralhar<T>(lista: readonly T[], aleatorio: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    const a = copia[i] as T;
    const b = copia[j] as T;
    copia[i] = b;
    copia[j] = a;
  }
  return copia;
}

/** Semente estavel a partir de um texto (ex.: id da rodada). */
export function sementeDeTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
