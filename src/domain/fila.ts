/**
 * Lista de espera.
 *
 * Duas regras mandam aqui:
 *
 * 1. Prioridade: mensalista antes de avulso; dentro da mesma faixa, quem
 *    confirmou primeiro. Assiduidade NUNCA entra nesse criterio — ela e
 *    so estatistica de resenha.
 *
 * 2. Janela das 5 horas: ate esse momento, as vagas ficam guardadas para os
 *    mensalistas, mesmo que sobre lugar. Passada a janela, as vagas que
 *    sobraram liberam para os avulsos.
 *
 * Decisao do grupo: vaga confirmada e definitiva. Um mensalista que aparece
 * depois nao derruba ninguem que ja esta dentro — ele vai para o topo da
 * espera e entra se alguem cancelar. A configuracao
 * `member_can_reclaim_slot` permite mudar isso no futuro.
 */

import { vagasLivres } from "./presenca";
import type { ParticipanteDoDominio, PrazosDeFila, RodadaDoDominio } from "./tipos";

/** Ordem oficial da fila: faixa primeiro, depois ordem de chegada. */
export function ordenarFila(participantes: ParticipanteDoDominio[]): ParticipanteDoDominio[] {
  return [...participantes].sort((a, b) => {
    if (a.faixa !== b.faixa) return a.faixa - b.faixa;
    const diferenca = a.entrouEm.getTime() - b.entrouEm.getTime();
    if (diferenca !== 0) return diferenca;
    // Empate exato de milissegundo: desempata pelo id, so para a ordem ser estavel.
    return a.id.localeCompare(b.id);
  });
}

export function janelaDeAvulsosAberta(rodada: RodadaDoDominio, agora: Date): boolean {
  return agora >= rodada.avulsosLiberadosEm;
}

/**
 * Quem esta apto a ser chamado agora, na ordem.
 *
 * Antes da janela, apenas mensalistas. Depois, todo mundo — mas mensalista
 * continua na frente de avulso dentro da fila.
 */
export function filaElegivel(
  participantes: ParticipanteDoDominio[],
  rodada: RodadaDoDominio,
  agora: Date,
): ParticipanteDoDominio[] {
  const esperando = participantes.filter((p) => p.situacao === "waiting");
  const fila = ordenarFila(esperando);

  if (janelaDeAvulsosAberta(rodada, agora)) return fila;
  return fila.filter((p) => p.faixa === 0);
}

/**
 * Prazo para aceitar a vaga.
 *
 * Perto do racha o prazo encurta: nao adianta dar uma hora e meia para
 * responder quando a bola rola em duas. O limite nunca passa do inicio da
 * partida.
 */
export function prazoParaAceitarVaga(
  rodada: RodadaDoDominio,
  agora: Date,
  prazos: PrazosDeFila,
): Date {
  const horasAteOJogo = (rodada.comecaEm.getTime() - agora.getTime()) / 3_600_000;

  const minutos =
    horasAteOJogo <= prazos.horasParaConsiderarUrgente
      ? prazos.minutosParaAceitarUrgente
      : prazos.minutosParaAceitar;

  const limite = new Date(agora.getTime() + minutos * 60_000);

  // Nunca prometer um prazo que termina depois do jogo comecar.
  return limite > rodada.comecaEm ? new Date(rodada.comecaEm) : limite;
}

export interface PromocaoDaFila {
  participante: ParticipanteDoDominio;
  expiraEm: Date;
}

/**
 * Quem sobe agora e ate quando cada um tem para confirmar.
 *
 * Nao altera nada: devolve a decisao para o servico aplicar no banco e
 * disparar as notificacoes.
 */
export function promoverDaFila(
  participantes: ParticipanteDoDominio[],
  rodada: RodadaDoDominio,
  agora: Date,
  prazos: PrazosDeFila,
): PromocaoDaFila[] {
  const livres = vagasLivres(rodada.capacidade, participantes);
  if (livres <= 0) return [];

  const elegiveis = filaElegivel(participantes, rodada, agora).slice(0, livres);
  const expiraEm = prazoParaAceitarVaga(rodada, agora, prazos);

  return elegiveis.map((participante) => ({ participante, expiraEm }));
}

/**
 * Convites de vaga cujo prazo terminou. Quem nao respondeu perde a vez e
 * volta para o fim da fila da sua faixa.
 */
export function convitesExpirados(
  participantes: ParticipanteDoDominio[],
  agora: Date,
): ParticipanteDoDominio[] {
  return participantes.filter(
    (p) => p.situacao === "invited" && p.conviteExpiraEm != null && p.conviteExpiraEm <= agora,
  );
}

/**
 * Posicao da pessoa na fila, comecando em 1. Retorna null se ela nao estiver
 * esperando.
 */
export function posicaoNaFila(
  participantes: ParticipanteDoDominio[],
  profileId: string,
): number | null {
  const fila = ordenarFila(participantes.filter((p) => p.situacao === "waiting"));
  const indice = fila.findIndex((p) => p.profileId === profileId);
  return indice >= 0 ? indice + 1 : null;
}

/** Resumo da lista para os cartoes da tela. */
export interface ResumoDaLista {
  confirmados: number;
  convidados: number;
  esperando: number;
  vagasLivres: number;
  capacidade: number;
  lotado: boolean;
}

export function resumirLista(
  participantes: ParticipanteDoDominio[],
  rodada: RodadaDoDominio,
): ResumoDaLista {
  const confirmados = participantes.filter((p) => p.situacao === "confirmed").length;
  const convidados = participantes.filter((p) => p.situacao === "invited").length;
  const esperando = participantes.filter((p) => p.situacao === "waiting").length;
  const livres = vagasLivres(rodada.capacidade, participantes);

  return {
    confirmados,
    convidados,
    esperando,
    vagasLivres: livres,
    capacidade: rodada.capacidade,
    lotado: livres === 0,
  };
}
