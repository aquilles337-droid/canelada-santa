"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirJogoAction } from "@/server/actions/partidas";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";

export function AbrirJogo({ rodadaId, temTimes }: { rodadaId: string; temTimes: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [abrindo, iniciar] = useTransition();

  if (!temTimes) {
    return (
      <EstadoVazio
        icone="🎽"
        titulo="Gere os times primeiro"
        descricao="O modo jogo precisa dos times sorteados para montar as partidas."
      />
    );
  }

  return (
    <EstadoVazio
      icone="🏟️"
      titulo="Tudo pronto para começar"
      descricao="A primeira partida é entre os dois primeiros times. Quem ganhar, fica."
      acao={
        <Botao
          tamanho="xl"
          carregando={abrindo}
          onClick={() =>
            iniciar(async () => {
              const resultado = await abrirJogoAction(rodadaId);
              if (resultado.ok) router.refresh();
              else toast.erro(resultado.mensagem);
            })
          }
        >
          Abrir o jogo
        </Botao>
      }
    />
  );
}
