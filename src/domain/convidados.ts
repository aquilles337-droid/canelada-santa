/**
 * Convidados.
 *
 * Convidado NAO e usuario do sistema: nao tem conta, nao entra no ranking e
 * nao confirma nada sozinho. Ele existe preso ao mensalista que o levou, que
 * gasta uma cota do mes e paga por ele.
 *
 * Convidado sempre entra por ultimo: so ocupa vaga que sobrou depois de
 * mensalistas e avulsos.
 */

import { negar, PERMITIDO, type Veredito } from "./tipos";

export interface RegrasDeConvidado {
  /** Quantos convidados cada mensalista pode levar por mes. */
  cotaPorMes: number;
  /** Se avulsos tambem podem levar convidado. */
  permitirConvidadoDeAvulso: boolean;
  precoConvidadoDeMensalistaCentavos: number;
  precoConvidadoDeAvulsoCentavos: number;
}

export interface ContextoDeConvidado {
  anfitriaoEhMensalista: boolean;
  convidadosJaUsadosNoMes: number;
  regras: RegrasDeConvidado;
  /** Situacao da rodada, para nao aceitar convidado em racha encerrado. */
  listaAberta: boolean;
}

/** O anfitriao pode cadastrar mais um convidado? */
export function podeLevarConvidado(contexto: ContextoDeConvidado): Veredito {
  if (!contexto.listaAberta) {
    return negar("A lista deste racha já fechou.");
  }

  if (!contexto.anfitriaoEhMensalista && !contexto.regras.permitirConvidadoDeAvulso) {
    return negar("Só mensalista pode levar convidado.");
  }

  if (contexto.regras.cotaPorMes <= 0) {
    return negar("O grupo não está aceitando convidados no momento.");
  }

  if (contexto.convidadosJaUsadosNoMes >= contexto.regras.cotaPorMes) {
    return negar(
      `Você já usou seus ${contexto.regras.cotaPorMes} convidados deste mês.`,
    );
  }

  return PERMITIDO;
}

/** Quantos convidados ainda cabem na cota do mes. */
export function convidadosRestantes(contexto: ContextoDeConvidado): number {
  return Math.max(0, contexto.regras.cotaPorMes - contexto.convidadosJaUsadosNoMes);
}

/** Preco do convidado, conforme o vinculo de quem o levou. */
export function precoDoConvidado(
  anfitriaoEhMensalista: boolean,
  regras: RegrasDeConvidado,
): number {
  return anfitriaoEhMensalista
    ? regras.precoConvidadoDeMensalistaCentavos
    : regras.precoConvidadoDeAvulsoCentavos;
}

/**
 * Quantos convidados cabem na rodada depois que os jogadores do grupo ja
 * estao acomodados.
 */
export function vagasParaConvidados(
  capacidade: number,
  jogadoresOcupandoVaga: number,
  convidadosJaConfirmados: number,
): number {
  return Math.max(0, capacidade - jogadoresOcupandoVaga - convidadosJaConfirmados);
}

/** Nivel informado pelo anfitriao, limitado a faixa valida de 0 a 10. */
export function nivelValido(nivel: number): boolean {
  return Number.isFinite(nivel) && nivel >= 0 && nivel <= 10;
}
