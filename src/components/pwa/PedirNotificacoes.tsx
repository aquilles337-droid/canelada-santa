"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alternarNotificacoes } from "@/server/actions/jogadores";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { detectarPlataforma, estaInstalado } from "@/lib/dispositivo";
import { useEstaNoCliente } from "./useEstaNoCliente";

/**
 * Pedido de notificação, logo na entrada.
 *
 * Por que não pedir sozinho, assim que a tela abre: quando o aviso do
 * navegador aparece do nada, a maioria nega no susto — e negar é definitivo,
 * o site não pode perguntar de novo. Então explicamos primeiro o que a
 * pessoa ganha e só disparamos o pedido de verdade quando ela toca no botão.
 *
 * O cartão fica visível enquanto a permissão não for dada. Quem negou recebe
 * o caminho para liberar na mão.
 */

/** A chave VAPID vem em base64url e o navegador exige bytes. */
function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizada = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normalizada);

  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

type Situacao = "pedindo" | "negado" | "pronto";

export function PedirNotificacoes({ chavePublica }: { chavePublica: string | null }) {
  const noCliente = useEstaNoCliente();
  const toast = useToast();
  const router = useRouter();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [trabalhando, iniciar] = useTransition();

  if (!noCliente || !chavePublica) return null;
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return null;

  // A permissão do navegador manda; o estado local só reflete o que acabou
  // de acontecer nesta tela.
  const permissao = Notification.permission;
  const atual: Situacao =
    situacao ?? (permissao === "granted" ? "pronto" : permissao === "denied" ? "negado" : "pedindo");

  if (atual === "pronto") return null;

  const plataforma = detectarPlataforma();

  // No iPhone, notificação só existe depois que o aplicativo é instalado.
  // Pedir antes disso confunde: o navegador simplesmente não deixa.
  if (plataforma === "ios" && !estaInstalado()) {
    return (
      <div className="superficie border-ouro/30 p-4">
        <p className="titulo-display text-base">
          <span aria-hidden className="mr-1.5">
            🔔
          </span>
          Quer receber aviso de vaga?
        </p>
        <p className="mt-1 text-sm text-cinza">
          No iPhone, os avisos só funcionam com o aplicativo instalado na tela inicial. Instale
          pelo convite acima e o pedido aparece em seguida.
        </p>
      </div>
    );
  }

  const pedir = () =>
    iniciar(async () => {
      try {
        const resposta = await Notification.requestPermission();

        if (resposta !== "granted") {
          setSituacao("negado");
          return;
        }

        const registro = await navigator.serviceWorker.ready;
        const inscricao = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveParaBytes(chavePublica),
        });

        const enviada = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(inscricao.toJSON()),
        });

        if (!enviada.ok) throw new Error("falha ao registrar");

        await alternarNotificacoes(true);
        setSituacao("pronto");
        toast.sucesso("Pronto! Você vai ser avisado quando abrir vaga. ⚽");
        router.refresh();
      } catch (erro) {
        console.error("[canelada] falha ao ativar notificações", erro);
        toast.erro("Não foi possível ativar agora. Tente de novo pelo Perfil.");
      }
    });

  if (atual === "negado") {
    return (
      <div className="superficie border-ambar/40 p-4">
        <p className="titulo-display text-base text-ambar">
          <span aria-hidden className="mr-1.5">
            🔕
          </span>
          Avisos bloqueados
        </p>
        <p className="mt-1 text-sm text-cinza">
          Você vai perder o aviso de vaga liberada — e a vaga vai para quem responder primeiro.
        </p>
        <p className="mt-2 text-xs text-cinza-escuro">
          {plataforma === "ios" ? (
            <>
              Para liberar: <strong>Ajustes</strong> do iPhone → <strong>Canelada Santa</strong> →{" "}
              <strong>Notificações</strong> → permitir.
            </>
          ) : (
            <>
              Para liberar: toque no <strong>cadeado</strong> ao lado do endereço →{" "}
              <strong>Notificações</strong> → permitir. Depois recarregue esta página.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="superficie border-ouro/40 p-4 animate-subir">
      <p className="titulo-display text-base">
        <span aria-hidden className="mr-1.5">
          🔔
        </span>
        Ative os avisos do racha
      </p>

      <p className="mt-1 text-sm text-cinza">
        Quando abrir vaga, quem confirma primeiro joga. Sem o aviso, você só descobre quando já
        foi.
      </p>

      <ul className="mt-2 flex flex-col gap-1 text-xs text-cinza-escuro">
        <li>⚽ Lista aberta e vaga liberada</li>
        <li>🎽 Times sorteados e racha começando</li>
        <li>💰 Pagamento confirmado</li>
      </ul>

      <Botao className="mt-3" tamanho="lg" larguraTotal carregando={trabalhando} onClick={pedir}>
        Quero ser avisado
      </Botao>

      <p className="mt-2 text-center text-[11px] text-cinza-escuro">
        Dá para desligar quando quiser, no seu Perfil.
      </p>
    </div>
  );
}
