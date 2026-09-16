"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarMensalidadesAction } from "@/server/actions/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";

export function GerarMensalidades() {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <Botao
      tamanho="sm"
      carregando={executando}
      onClick={() =>
        iniciar(async () => {
          const resultado = await gerarMensalidadesAction();
          if (resultado.ok) {
            toast.sucesso(
              resultado.dados.geradas > 0
                ? `${resultado.dados.geradas} mensalidade(s) gerada(s).`
                : "As mensalidades deste mês já estavam geradas.",
            );
            router.refresh();
          } else {
            toast.erro(resultado.mensagem);
          }
        })
      }
    >
      Gerar mês
    </Botao>
  );
}
