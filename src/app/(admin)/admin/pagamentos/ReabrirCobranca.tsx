"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reabrirCobrancaAction } from "@/server/actions/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";

/** Desfaz um perdão: a cobrança volta a ficar em aberto para o jogador. */
export function ReabrirCobranca({ cobrancaId }: { cobrancaId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <Botao
      variante="contorno"
      tamanho="sm"
      disabled={executando}
      onClick={() =>
        iniciar(async () => {
          const resultado = await reabrirCobrancaAction(cobrancaId);
          if (resultado.ok) {
            toast.sucesso("Cobrança reaberta.");
            router.refresh();
          } else {
            toast.erro(resultado.mensagem);
          }
        })
      }
    >
      Cobrar de novo
    </Botao>
  );
}
