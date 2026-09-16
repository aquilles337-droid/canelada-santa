/**
 * Avaliação dos jogadores.
 *
 * Nota de 0 a 10, votação anônima, ninguém vota em si mesmo. A nota final é
 * a média das avaliações válidas — e só vira nota "oficial" depois de um
 * mínimo de votos, para um voto isolado não definir a fama de ninguém.
 */

import type { CategoriaNota } from "@/lib/supabase/tipos";
import { negar, PERMITIDO, type Veredito } from "./tipos";

export interface ContextoDeVoto {
  votanteId: string;
  avaliadoId: string;
  votanteEstaAtivo: boolean;
  nota: number;
}

export function podeAvaliar(contexto: ContextoDeVoto): Veredito {
  if (contexto.votanteId === contexto.avaliadoId) {
    return negar("Você não pode avaliar a si mesmo.");
  }
  if (!contexto.votanteEstaAtivo) {
    return negar("Só quem está ativo no grupo pode avaliar.");
  }
  if (!Number.isFinite(contexto.nota) || contexto.nota < 0 || contexto.nota > 10) {
    return negar("A nota vai de 0 a 10.");
  }

  return PERMITIDO;
}

/** Média das avaliações. Devolve null quando ninguém votou. */
export function mediaDasNotas(notas: number[]): number | null {
  if (notas.length === 0) return null;
  const soma = notas.reduce((total, nota) => total + nota, 0);
  return Math.round((soma / notas.length) * 100) / 100;
}

export interface NotaConsolidada {
  nota: number;
  votos: number;
  temVotosSuficientes: boolean;
}

/**
 * Nota que o algoritmo de times usa.
 *
 * Abaixo do mínimo de votos, vale a nota padrão configurada — o sistema não
 * inventa uma habilidade que ninguém avaliou.
 */
export function consolidarNota(
  notas: number[],
  notaPadrao: number,
  minimoDeVotos: number,
): NotaConsolidada {
  const media = mediaDasNotas(notas);
  const temVotosSuficientes = notas.length >= minimoDeVotos && media !== null;

  return {
    nota: temVotosSuficientes ? (media as number) : notaPadrao,
    votos: notas.length,
    temVotosSuficientes,
  };
}

/**
 * Categoria textual da nota (BAGRE, INICIANTE, REGULAR, BOM, CRAQUE).
 * As faixas vêm das configurações, então o grupo pode mudá-las.
 */
export function categoriaDaNota(nota: number, categorias: CategoriaNota[]): CategoriaNota | null {
  if (categorias.length === 0) return null;

  const ordenadas = [...categorias].sort((a, b) => a.min - b.min);

  for (let i = 0; i < ordenadas.length; i++) {
    const categoria = ordenadas[i];
    if (!categoria) continue;

    // O topo da última faixa é inclusivo, senão a nota 10 ficaria sem categoria.
    const ehUltima = i === ordenadas.length - 1;
    const dentro = nota >= categoria.min && (ehUltima ? nota <= categoria.max : nota < categoria.max);

    if (dentro) return categoria;
  }

  return ordenadas[0] ?? null;
}

// ------------------------------------------------------------
// Craque e bagre da rodada
// ------------------------------------------------------------

export interface ContextoDeVotoDaRodada {
  votanteId: string;
  escolhidoId: string;
  /** Quem votou participou da rodada? */
  votanteParticipou: boolean;
  /** Quem foi escolhido participou da rodada? */
  escolhidoParticipou: boolean;
  rodadaFinalizada: boolean;
}

export function podeVotarNaRodada(contexto: ContextoDeVotoDaRodada): Veredito {
  if (!contexto.rodadaFinalizada) {
    return negar("A votação abre quando o racha terminar.");
  }
  if (!contexto.votanteParticipou) {
    return negar("Só quem jogou pode votar nesta rodada.");
  }
  if (contexto.votanteId === contexto.escolhidoId) {
    return negar("Você não pode votar em si mesmo.");
  }
  if (!contexto.escolhidoParticipou) {
    return negar("Você só pode votar em quem jogou a rodada.");
  }

  return PERMITIDO;
}

export interface ApuracaoDeVotos {
  vencedorId: string | null;
  votos: number;
  empate: boolean;
  totalDeVotos: number;
}

/**
 * Apura uma votação. Empate no topo é informado, não desempatado às cegas —
 * cabe à tela dizer que a disputa está empatada.
 */
export function apurarVotos(contagem: { alvoId: string; votos: number }[]): ApuracaoDeVotos {
  const total = contagem.reduce((soma, linha) => soma + linha.votos, 0);
  if (contagem.length === 0) {
    return { vencedorId: null, votos: 0, empate: false, totalDeVotos: 0 };
  }

  const maximo = Math.max(...contagem.map((linha) => linha.votos));
  const lideres = contagem.filter((linha) => linha.votos === maximo);

  return {
    vencedorId: lideres.length === 1 ? (lideres[0]?.alvoId ?? null) : null,
    votos: maximo,
    empate: lideres.length > 1,
    totalDeVotos: total,
  };
}
