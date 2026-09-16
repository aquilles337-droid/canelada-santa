"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removerParticipanteAction } from "@/server/actions/presenca";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";

export function RemoverJogador({
  rodadaId,
  participacaoId,
}: {
  rodadaId: string;
  participacaoId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      disabled={executando}
      aria-label="Remover jogador da lista"
      onClick={() =>
        iniciar(async () => {
          const resultado = await removerParticipanteAction(rodadaId, participacaoId);
          if (resultado.ok) {
            toast.mostrar("Jogador removido da lista.", "aviso");
            router.refresh();
          } else {
            toast.erro(resultado.mensagem);
          }
        })
      }
    >
      Remover
    </Botao>
  );
}
