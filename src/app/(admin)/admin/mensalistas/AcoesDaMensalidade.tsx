"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  perdoarMensalidadeAction,
  quitarMensalidadeAction,
  reabrirMensalidadeAction,
} from "@/server/actions/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";

/**
 * Muda a situação da mensalidade de um jogador.
 *
 * Os dois botões tiram a pessoa da inadimplência, por caminhos diferentes:
 * "Pagou" registra que o dinheiro entrou (em dinheiro, na quadra);
 * "Perdoar" anula a cobrança sem pagamento — quem estava machucado ou
 * viajando. Nenhum dos dois apaga a competência do histórico.
 */
export function AcoesDaMensalidade({
  mensalidadeId,
  perdoada = false,
}: {
  mensalidadeId: string;
  /** Perdoada ou cancelada: o único caminho é voltar a cobrar. */
  perdoada?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  const rodar = (acao: () => Promise<{ ok: boolean; mensagem?: string }>, mensagemOk: string) =>
    iniciar(async () => {
      const resultado = await acao();
      if (resultado.ok) {
        toast.sucesso(mensagemOk);
        router.refresh();
      } else {
        toast.erro(resultado.mensagem ?? "Não foi possível concluir.");
      }
    });

  if (perdoada) {
    return (
      <Botao
        variante="contorno"
        tamanho="sm"
        disabled={executando}
        onClick={() =>
          rodar(() => reabrirMensalidadeAction(mensalidadeId), "Mensalidade voltou a ser cobrada.")
        }
      >
        Cobrar de novo
      </Botao>
    );
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Botao
        variante="sucesso"
        tamanho="sm"
        disabled={executando}
        onClick={() => rodar(() => quitarMensalidadeAction(mensalidadeId), "Mensalidade quitada.")}
      >
        Pagou
      </Botao>

      <Botao
        variante="fantasma"
        tamanho="sm"
        disabled={executando}
        onClick={() =>
          rodar(
            () => perdoarMensalidadeAction(mensalidadeId, "perdoada pelo administrador"),
            "Mensalidade perdoada.",
          )
        }
      >
        Perdoar
      </Botao>
    </div>
  );
}
