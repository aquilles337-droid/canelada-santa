"use client";

import { useTransition } from "react";
import { sair } from "@/server/actions/auth";
import { Botao } from "@/components/ui/Botao";

export function BotaoSair() {
  const [saindo, iniciar] = useTransition();

  return (
    <Botao
      variante="fantasma"
      larguraTotal
      carregando={saindo}
      onClick={() => iniciar(() => void sair())}
    >
      Sair da conta
    </Botao>
  );
}
