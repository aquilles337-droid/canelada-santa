"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirRodadaAction,
  cancelarRodadaAction,
  fecharListaAction,
  finalizarRodadaAction,
  iniciarRodadaAction,
} from "@/server/actions/rodadas";
import { promoverFilaAction } from "@/server/actions/presenca";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import type { RoundStatus } from "@/lib/supabase/tipos";

export function AcoesDaRodada({ rodadaId, situacao }: { rodadaId: string; situacao: RoundStatus }) {
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

  return (
    <div className="flex flex-wrap gap-2">
      {situacao === "draft" && (
        <Botao
          disabled={executando}
          onClick={() => rodar(() => abrirRodadaAction(rodadaId), "Lista aberta para o grupo.")}
        >
          Abrir lista
        </Botao>
      )}

      {situacao === "open" && (
        <>
          <Botao
            variante="escuro"
            disabled={executando}
            onClick={() => rodar(() => fecharListaAction(rodadaId), "Lista fechada.")}
          >
            Fechar lista
          </Botao>
          <Botao
            variante="contorno"
            disabled={executando}
            onClick={() =>
              rodar(async () => {
                const r = await promoverFilaAction(rodadaId);
                return r.ok
                  ? { ok: true, mensagem: `${r.dados.chamados} chamado(s).` }
                  : { ok: false, mensagem: r.mensagem };
              }, "Fila atualizada.")
            }
          >
            Chamar da fila
          </Botao>
        </>
      )}

      {situacao === "closed" && (
        <Botao
          disabled={executando}
          onClick={() => rodar(() => iniciarRodadaAction(rodadaId), "Racha começou!")}
        >
          Iniciar racha
        </Botao>
      )}

      {situacao === "in_progress" && (
        <Botao
          disabled={executando}
          onClick={() => rodar(() => finalizarRodadaAction(rodadaId), "Racha encerrado.")}
        >
          Encerrar racha
        </Botao>
      )}

      {situacao !== "cancelled" && situacao !== "finished" && (
        <Botao
          variante="perigo"
          disabled={executando}
          onClick={() => rodar(() => cancelarRodadaAction(rodadaId), "Racha cancelado.")}
        >
          Cancelar racha
        </Botao>
      )}
    </div>
  );
}
