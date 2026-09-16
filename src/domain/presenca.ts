/**
 * Regras de presenca: quem pode entrar na rodada, em que situacao entra e
 * o que acontece quando desiste.
 */

import type { ChargeStatus, ChargeType, MemberStatus } from "@/lib/supabase/tipos";
import {
  FAIXA_MENSALISTA,
  negar,
  PERMITIDO,
  type ParticipanteDoDominio,
  type RodadaDoDominio,
  type Veredito,
} from "./tipos";

/** Cobranca em aberto que pode bloquear a entrada numa nova rodada. */
export interface DebitoEmAberto {
  id: string;
  tipo: ChargeType;
  situacao: ChargeStatus;
  valorCentavos: number;
  /** Rodada que originou a cobranca; nulo para mensalidade. */
  rodadaId: string | null;
  descricao: string;
}

export interface ContextoDeEntrada {
  rodada: RodadaDoDominio;
  /** Situacao do jogador no grupo. */
  situacaoDoJogador: MemberStatus;
  ehMensalista: boolean;
  /** Participacao existente, se a pessoa ja mexeu nessa rodada. */
  participacaoAtual?: ParticipanteDoDominio | null;
  /** Cobrancas em aberto do jogador. */
  debitos: DebitoEmAberto[];
  bloquearPorDebito: boolean;
  agora: Date;
}

/**
 * Debitos que bloqueiam a entrada numa NOVA rodada.
 *
 * A cobranca gerada pela propria rodada em que a pessoa esta entrando nunca
 * bloqueia essa rodada — senao ninguem conseguiria jogar a partida que
 * acabou de gerar a cobranca.
 */
export function debitosQueBloqueiam(
  debitos: DebitoEmAberto[],
  rodadaAtualId: string | null,
): DebitoEmAberto[] {
  return debitos.filter(
    (debito) =>
      (debito.situacao === "pending" || debito.situacao === "expired") &&
      debito.rodadaId !== rodadaAtualId,
  );
}

/** Soma dos debitos que bloqueiam, em centavos. */
export function totalDeDebitos(debitos: DebitoEmAberto[]): number {
  return debitos.reduce((soma, debito) => soma + debito.valorCentavos, 0);
}

/**
 * O jogador pode confirmar presenca nesta rodada?
 *
 * Responde tambem quando o motivo e "ja esta dentro" ou "esta na espera",
 * para a tela saber o que mostrar.
 */
export function podeEntrarNaRodada(contexto: ContextoDeEntrada): Veredito {
  const { rodada, agora } = contexto;

  if (rodada.situacao === "cancelled") return negar("Este racha foi cancelado.");
  if (rodada.situacao === "draft") return negar("Este racha ainda não foi aberto.");
  if (rodada.situacao === "finished") return negar("Este racha já acabou.");
  if (rodada.situacao === "in_progress") return negar("Este racha já começou.");
  if (rodada.situacao === "closed" || agora >= rodada.listaFechaEm) {
    return negar("A lista deste racha já fechou.");
  }

  switch (contexto.situacaoDoJogador) {
    case "banned":
      return negar("Seu acesso está bloqueado. Fale com um administrador.");
    case "suspended":
      return negar("Sua conta está suspensa no momento.");
    case "inactive":
      return negar("Sua conta está inativa. Fale com um administrador.");
    default:
      break;
  }

  const atual = contexto.participacaoAtual;
  if (atual && (atual.situacao === "confirmed" || atual.situacao === "waiting" || atual.situacao === "invited")) {
    return negar("Você já está nesta lista.");
  }

  if (contexto.bloquearPorDebito) {
    const bloqueios = debitosQueBloqueiam(contexto.debitos, rodada.id);
    if (bloqueios.length > 0) {
      return negar("Você tem pagamento em aberto. Quite para entrar no próximo racha.");
    }
  }

  return PERMITIDO;
}

/**
 * Onde a pessoa cai ao confirmar: direto na vaga ou na lista de espera.
 *
 * Antes da janela das 5 horas, avulso NUNCA ocupa vaga livre, mesmo que
 * sobre lugar — a vaga fica guardada para os mensalistas.
 */
export function destinoAoEntrar(
  contexto: { ehMensalista: boolean; vagasLivres: number; rodada: RodadaDoDominio; agora: Date },
): "confirmed" | "waiting" {
  const janelaAberta = contexto.agora >= contexto.rodada.avulsosLiberadosEm;
  const podeOcuparVaga = contexto.ehMensalista || janelaAberta;

  return podeOcuparVaga && contexto.vagasLivres > 0 ? "confirmed" : "waiting";
}

/** Vagas realmente livres. Quem foi convidado da fila segura a vaga ate o prazo. */
export function vagasLivres(capacidade: number, participantes: ParticipanteDoDominio[]): number {
  const ocupadas = participantes.filter(
    (p) => p.situacao === "confirmed" || p.situacao === "invited",
  ).length;

  return Math.max(0, capacidade - ocupadas);
}

// ------------------------------------------------------------
// Cancelamento e multas
// ------------------------------------------------------------

/** Momento a partir do qual desistir gera multa. */
export function limiteParaCancelarSemMulta(rodada: RodadaDoDominio): Date {
  return new Date(rodada.comecaEm.getTime() - rodada.horasLimiteParaCancelar * 3_600_000);
}

export function podeCancelarSemMulta(rodada: RodadaDoDominio, agora: Date): boolean {
  return agora < limiteParaCancelarSemMulta(rodada);
}

export type MotivoDeMulta = "late_cancel" | "no_show";

/**
 * Valor da multa, em centavos.
 *
 * A falta sem aviso usa o multiplicador configurado sobre a multa de
 * cancelamento tardio (padrao 1,5x). Os dois valores saem do snapshot da
 * rodada, entao mudar a configuracao depois nao muda multa antiga.
 */
export function calcularMulta(rodada: RodadaDoDominio, motivo: MotivoDeMulta): number {
  const base = rodada.regrasDeMulta.late_cancel_fine_cents;

  if (motivo === "late_cancel") return Math.max(0, Math.round(base));

  const multiplicador = rodada.regrasDeMulta.no_show_multiplier;
  return Math.max(0, Math.round(base * multiplicador));
}

/**
 * O que acontece quando o jogador retira o nome.
 *
 * Quem estava apenas na espera nunca paga multa: ele nao ocupava vaga.
 */
export function avaliarCancelamento(
  rodada: RodadaDoDominio,
  participante: ParticipanteDoDominio,
  agora: Date,
): { geraMulta: boolean; valorCentavos: number } {
  const ocupavaVaga = participante.situacao === "confirmed";

  if (!ocupavaVaga || podeCancelarSemMulta(rodada, agora)) {
    return { geraMulta: false, valorCentavos: 0 };
  }

  return { geraMulta: true, valorCentavos: calcularMulta(rodada, "late_cancel") };
}

/**
 * O que acontece depois do racha, no controle de presenca.
 *
 * Falta justificada nao gera multa. Falta sem aviso gera a multa maior.
 */
export function avaliarFalta(
  rodada: RodadaDoDominio,
  justificada: boolean,
): { geraMulta: boolean; valorCentavos: number } {
  if (justificada) return { geraMulta: false, valorCentavos: 0 };
  return { geraMulta: true, valorCentavos: calcularMulta(rodada, "no_show") };
}

/** Faixa de prioridade a partir do vinculo do jogador. */
export function faixaDoJogador(ehMensalista: boolean): number {
  return ehMensalista ? FAIXA_MENSALISTA : 1;
}
