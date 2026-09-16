"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { baixarCobrancaAction, perdoarCobrancaAction } from "@/server/actions/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";

/**
 * Baixa manual e perdao. A baixa manual existe porque parte do grupo ainda
 * paga em dinheiro na quadra — sem ela o administrador ficaria sem saida.
 */
export function AcoesDaCobranca({ cobrancaId }: { cobrancaId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <div className="flex shrink-0 gap-1">
      <Botao
        variante="sucesso"
        tamanho="sm"
        disabled={executando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await baixarCobrancaAction(cobrancaId, "baixa manual pelo administrador");
            if (resultado.ok) {
              toast.sucesso("Pagamento registrado.");
              router.refresh();
            } else {
              toast.erro(resultado.mensagem);
            }
          })
        }
      >
        Pagou
      </Botao>

      <Botao
        variante="fantasma"
        tamanho="sm"
        disabled={executando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await perdoarCobrancaAction(cobrancaId, "perdoado pelo administrador");
            if (resultado.ok) {
              toast.mostrar("Cobrança perdoada.", "aviso");
              router.refresh();
            } else {
              toast.erro(resultado.mensagem);
            }
          })
        }
      >
        Perdoar
      </Botao>
    </div>
  );
}
