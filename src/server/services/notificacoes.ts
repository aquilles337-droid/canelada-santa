import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/tipos";

/**
 * Notificacoes.
 *
 * Cada aviso e gravado como notificacao no aplicativo e, quando o jogador
 * autorizou, tambem sai como Web Push (ver src/server/notificacoes/push.ts).
 * O envio nunca derruba a operacao principal: se o push falhar, a presenca,
 * o pagamento ou a promocao da fila continuam valendo.
 */

export type TipoDeNotificacao =
  | "rodada.aberta"
  | "rodada.lembrete"
  | "rodada.comecando"
  | "rodada.cancelada"
  | "rodada.alterada"
  | "vaga.liberada"
  | "vaga.perdida"
  | "vaga.prazo_acabando"
  | "lista.fechada"
  | "pagamento.confirmado"
  | "pagamento.pendente"
  | "multa.aplicada"
  | "times.gerados"
  | "resultado.disponivel"
  | "votacao.craque"
  | "votacao.bagre";

export interface Aviso {
  destinatarios: string[];
  tipo: TipoDeNotificacao;
  titulo: string;
  corpo: string;
  url?: string | null;
  dados?: Record<string, unknown>;
}

/** Grava as notificacoes e dispara o push para quem aceitou receber. */
export async function notificar(aviso: Aviso): Promise<void> {
  const destinatarios = [...new Set(aviso.destinatarios)].filter(Boolean);
  if (destinatarios.length === 0) return;

  try {
    await clienteAdmin()
      .from("notifications")
      .insert(
        destinatarios.map((profileId) => ({
          profile_id: profileId,
          type: aviso.tipo,
          title: aviso.titulo,
          body: aviso.corpo,
          url: aviso.url ?? null,
          data: (aviso.dados ?? null) as Json,
        })),
      );
  } catch (erro) {
    console.error("[canelada] falha ao gravar notificacao", aviso.tipo, erro);
    return;
  }

  // Importado sob demanda para o web-push nao entrar no pacote quando o
  // grupo ainda nao configurou as chaves VAPID.
  try {
    const { enviarPush } = await import("@/server/notificacoes/push");
    await enviarPush(destinatarios, {
      titulo: aviso.titulo,
      corpo: aviso.corpo,
      url: aviso.url ?? "/inicio",
      tipo: aviso.tipo,
    });
  } catch (erro) {
    console.error("[canelada] falha ao enviar push", aviso.tipo, erro);
  }
}

export async function marcarNotificacaoComoLida(profileId: string, notificacaoId: string): Promise<void> {
  await clienteAdmin()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificacaoId)
    .eq("profile_id", profileId);
}

export async function marcarTodasComoLidas(profileId: string): Promise<void> {
  await clienteAdmin()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);
}
