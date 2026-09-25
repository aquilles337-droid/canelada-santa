/**
 * Edicao de uma rodada que ja existe.
 *
 * Mexer numa rodada aberta nao e o mesmo que criar uma: tem gente com vaga
 * na mao. Duas linhas nao se cruzam aqui:
 *
 * 1. NINGUEM PERDE VAGA POR EDICAO. Reduzir as vagas abaixo de quem ja esta
 *    dentro seria escolher, em silencio, quem fica de fora. O sistema recusa
 *    e devolve a conta para o administrador, que tira quem tem de sair na
 *    lista, com nome e cara.
 *
 * 2. O SNAPSHOT NAO E REESCRITO. Preco e multa foram copiados para dentro da
 *    rodada na criacao justamente para nao mudar depois. A edicao mexe no que
 *    e organizacao do jogo — vagas, times, horario, local —, nunca no que ja
 *    virou dinheiro cobrado.
 */

import type { RoundStatus } from "@/lib/supabase/tipos";

/** O que a rodada e hoje. */
export interface RodadaParaEditar {
  situacao: RoundStatus;
  capacidade: number;
  /** Confirmados + chamados da fila: os dois seguram vaga. */
  vagasOcupadas: number;
  comecaEm: Date;
  listaFechaEm: Date;
  local: string;
}

/** O que o administrador quer que ela passe a ser. */
export interface EdicaoDaRodada {
  capacidade: number;
  quantidadeDeTimes: number;
  jogadoresPorTime: number | null;
  minutosPorPartida: number;
  golsParaVencer: number;
  comecaEm: Date;
  listaFechaEm: Date;
  local: string;
}

export interface VereditoDaEdicao {
  /** Vazio quando a edicao pode ser salva. */
  problemas: string[];
  /** Abriu vaga: vale chamar a fila logo depois de salvar. */
  chamarFila: boolean;
  /** Mudou o que a pessoa precisa saber para aparecer no lugar certo, na hora certa. */
  avisarOGrupo: boolean;
}

const SITUACOES_QUE_NAO_SE_EDITAM: RoundStatus[] = ["finished", "cancelled"];

export function avaliarEdicao(
  atual: RodadaParaEditar,
  novo: EdicaoDaRodada,
  agora: Date,
): VereditoDaEdicao {
  const problemas: string[] = [];

  if (SITUACOES_QUE_NAO_SE_EDITAM.includes(atual.situacao)) {
    problemas.push(
      atual.situacao === "finished"
        ? "Este racha já foi encerrado e não pode mais ser alterado."
        : "Este racha foi cancelado e não pode mais ser alterado.",
    );
    // Sem sentido continuar conferindo campo de uma rodada que nao se edita.
    return { problemas, chamarFila: false, avisarOGrupo: false };
  }

  if (!Number.isInteger(novo.capacidade) || novo.capacidade < 2) {
    problemas.push("A quantidade de vagas precisa ser um número inteiro de pelo menos 2.");
  } else if (novo.capacidade < atual.vagasOcupadas) {
    problemas.push(
      `Já tem ${atual.vagasOcupadas} ${atual.vagasOcupadas === 1 ? "pessoa" : "pessoas"} com vaga. ` +
        `Para deixar ${novo.capacidade} vagas, tire alguém da lista antes — ` +
        "o sistema não escolhe sozinho quem sai.",
    );
  }

  if (!Number.isInteger(novo.quantidadeDeTimes) || novo.quantidadeDeTimes < 2) {
    problemas.push("O racha precisa de pelo menos 2 times.");
  }

  if (novo.jogadoresPorTime !== null && (!Number.isInteger(novo.jogadoresPorTime) || novo.jogadoresPorTime < 1)) {
    problemas.push("Jogadores por time precisa ser um número inteiro de pelo menos 1, ou vazio.");
  }

  if (!Number.isInteger(novo.minutosPorPartida) || novo.minutosPorPartida < 1) {
    problemas.push("A duração da partida precisa ser de pelo menos 1 minuto.");
  }

  if (!Number.isInteger(novo.golsParaVencer) || novo.golsParaVencer < 1) {
    problemas.push("Os gols para vencer precisam ser pelo menos 1.");
  }

  if (novo.local.trim().length < 2) {
    problemas.push("Informe o local do racha.");
  }

  if (novo.listaFechaEm > novo.comecaEm) {
    problemas.push("A lista precisa fechar antes do início do racha.");
  }

  // Um racha que ainda nao comecou nao pode ser marcado para tras. Depois de
  // comecado, a data ja aconteceu e mexer nela e correcao de registro.
  const aindaNaoComecou = atual.situacao === "draft" || atual.situacao === "open" || atual.situacao === "closed";
  if (aindaNaoComecou && novo.comecaEm.getTime() <= agora.getTime()) {
    problemas.push("A data do racha precisa ser no futuro.");
  }

  const mudouHorario = novo.comecaEm.getTime() !== atual.comecaEm.getTime();
  const mudouLocal = novo.local.trim() !== atual.local.trim();

  return {
    problemas,
    // Só faz sentido chamar a fila enquanto a lista está de pé.
    chamarFila:
      problemas.length === 0 &&
      novo.capacidade > atual.capacidade &&
      (atual.situacao === "open" || atual.situacao === "closed"),
    avisarOGrupo: problemas.length === 0 && (mudouHorario || mudouLocal) && atual.situacao !== "draft",
  };
}
