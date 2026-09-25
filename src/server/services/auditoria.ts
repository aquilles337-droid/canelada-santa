import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/tipos";

/**
 * Registro de acoes administrativas.
 *
 * Toda decisao que mexe em dinheiro, presenca ou permissao de alguem deixa
 * rastro: quem fez, o que fez, sobre quem e com quais valores. A auditoria
 * nunca derruba a operacao principal — se a gravacao falhar, o erro e
 * registrado no log do servidor e a acao segue.
 */
export type AcaoAuditada =
  | "convite.criado"
  | "convite.revogado"
  | "jogador.cadastrado"
  | "jogador.banido"
  | "jogador.desbanido"
  | "jogador.suspenso"
  | "jogador.reativado"
  | "jogador.mensalista_alterado"
  | "jogador.papel_alterado"
  | "jogador.perfil_alterado_por_admin"
  | "rodada.criada"
  | "rodada.alterada"
  | "rodada.aberta"
  | "rodada.fechada"
  | "rodada.reaberta"
  | "rodada.finalizada"
  | "rodada.cancelada"
  | "presenca.marcada"
  | "presenca.falta_justificada"
  | "presenca.removido_pelo_admin"
  | "presenca.promovido_manualmente"
  | "convidado.adicionado"
  | "convidado.removido"
  | "cobranca.criada"
  | "cobranca.baixada_manualmente"
  | "cobranca.cancelada"
  | "cobranca.perdoada"
  | "multa.criada"
  | "multa.cancelada"
  | "mensalidade.gerada"
  | "times.gerados"
  | "partida.iniciada"
  | "partida.encerrada"
  | "partida.empate_sorteado"
  | "configuracao.alterada";

export interface EntradaDeAuditoria {
  atorId: string | null;
  acao: AcaoAuditada;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
}

export async function registrarAuditoria(entrada: EntradaDeAuditoria): Promise<void> {
  try {
    await clienteAdmin().from("audit_logs").insert({
      actor_id: entrada.atorId,
      action: entrada.acao,
      entity: entrada.entidade,
      entity_id: entrada.entidadeId ?? null,
      before: (entrada.antes ?? null) as Json,
      after: (entrada.depois ?? null) as Json,
    });
  } catch (erro) {
    console.error("[canelada] falha ao registrar auditoria", entrada.acao, erro);
  }
}
