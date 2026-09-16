import "server-only";

import webpush from "web-push";
import { clienteAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Web Push.
 *
 * As chaves VAPID sao opcionais: sem elas o sistema continua funcionando e
 * apenas deixa de enviar notificacoes ao celular (o aviso continua
 * aparecendo dentro do aplicativo). Inscricao expirada e removida sozinha.
 */

export interface ConteudoDoPush {
  titulo: string;
  corpo: string;
  url: string;
  tipo: string;
}

let configurado: boolean | null = null;

function configurar(): boolean {
  if (configurado !== null) return configurado;

  const cfg = env();
  if (!cfg.VAPID_PUBLIC_KEY || !cfg.VAPID_PRIVATE_KEY) {
    configurado = false;
    return false;
  }

  webpush.setVapidDetails(cfg.VAPID_SUBJECT, cfg.VAPID_PUBLIC_KEY, cfg.VAPID_PRIVATE_KEY);
  configurado = true;
  return true;
}

export async function enviarPush(profileIds: string[], conteudo: ConteudoDoPush): Promise<void> {
  if (!configurar() || profileIds.length === 0) return;

  const admin = clienteAdmin();

  const { data: perfis } = await admin
    .from("profiles")
    .select("id")
    .in("id", profileIds)
    .eq("notifications_enabled", true);

  const permitidos = (perfis ?? []).map((p) => p.id);
  if (permitidos.length === 0) return;

  const { data: inscricoes } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("profile_id", permitidos)
    .eq("enabled", true);

  if (!inscricoes || inscricoes.length === 0) return;

  const carga = JSON.stringify({
    title: conteudo.titulo,
    body: conteudo.corpo,
    url: conteudo.url,
    tag: conteudo.tipo,
  });

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
          },
          carga,
        );

        await admin
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", inscricao.id);
      } catch (erro) {
        const codigo = (erro as { statusCode?: number }).statusCode;

        // 404/410 = o navegador descartou a inscricao. Nao adianta insistir.
        if (codigo === 404 || codigo === 410) {
          await admin.from("push_subscriptions").delete().eq("id", inscricao.id);
          return;
        }

        await admin
          .from("push_subscriptions")
          .update({ failure_count: inscricao.failure_count + 1 })
          .eq("id", inscricao.id);
      }
    }),
  );
}
