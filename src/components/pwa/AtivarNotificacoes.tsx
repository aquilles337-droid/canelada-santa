"use client";

import { useState, useTransition } from "react";
import { alternarNotificacoes } from "@/server/actions/jogadores";
import { Botao } from "@/components/ui/Botao";
import { Selo } from "@/components/ui/Selo";
import { useToast } from "@/components/ui/Toast";

/**
 * Liga e desliga as notificações no aparelho.
 *
 * São dois níveis: a permissão do navegador (por aparelho) e a preferência
 * do jogador (na conta dele). Desligar aqui remove a inscrição deste celular
 * e também marca a preferência, para o sistema parar de tentar enviar.
 */

/** A chave VAPID vem em base64url e o navegador exige bytes. */
function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizada = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normalizada);

  // O ArrayBuffer explícito garante o tipo que a API de push exige.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export function AtivarNotificacoes({
  chavePublica,
  preferenciaLigada,
}: {
  chavePublica: string | null;
  preferenciaLigada: boolean;
}) {
  const toast = useToast();
  const [ligadas, setLigadas] = useState(preferenciaLigada);
  const [trabalhando, iniciar] = useTransition();

  if (!chavePublica) {
    return (
      <p className="rounded-xl border border-linha bg-carvao/50 px-4 py-3 text-sm text-cinza">
        As notificações ainda não foram configuradas pelo administrador do sistema.
      </p>
    );
  }

  const ativar = () =>
    iniciar(async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast.erro("Este navegador não suporta notificações.");
          return;
        }

        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
          toast.mostrar(
            "Você bloqueou as notificações. Para receber avisos de vaga, libere nas configurações do navegador.",
            "aviso",
          );
          return;
        }

        const registro = await navigator.serviceWorker.ready;
        const inscricao = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveParaBytes(chavePublica),
        });

        const resposta = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(inscricao.toJSON()),
        });

        if (!resposta.ok) throw new Error("falha ao registrar");

        await alternarNotificacoes(true);
        setLigadas(true);
        toast.sucesso("Pronto! Você vai ser avisado quando abrir vaga. ⚽");
      } catch (erro) {
        console.error("[canelada] falha ao ativar notificações", erro);
        toast.erro("Não foi possível ativar as notificações agora.");
      }
    });

  const desativar = () =>
    iniciar(async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registro = await navigator.serviceWorker.ready;
          const inscricao = await registro.pushManager.getSubscription();

          if (inscricao) {
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ endpoint: inscricao.endpoint }),
            });
            await inscricao.unsubscribe();
          }
        }

        await alternarNotificacoes(false);
        setLigadas(false);
        toast.mostrar("Notificações desligadas.", "aviso");
      } catch (erro) {
        console.error("[canelada] falha ao desativar notificações", erro);
        toast.erro("Não foi possível desligar agora.");
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Avisos no celular</p>
          <p className="text-xs text-cinza-escuro">
            Vaga liberada, lista aberta, pagamento confirmado e votação.
          </p>
        </div>
        <Selo tom={ligadas ? "verde" : "neutro"}>{ligadas ? "Ligado" : "Desligado"}</Selo>
      </div>

      {ligadas ? (
        <Botao variante="escuro" larguraTotal carregando={trabalhando} onClick={desativar}>
          Desligar notificações
        </Botao>
      ) : (
        <Botao larguraTotal carregando={trabalhando} onClick={ativar}>
          Ativar notificações
        </Botao>
      )}
    </div>
  );
}
