"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirRodadaAction,
  cancelarRodadaAction,
  fecharListaAction,
  finalizarRodadaAction,
  iniciarRodadaAction,
  reabrirListaAction,
} from "@/server/actions/rodadas";
import { promoverFilaAction } from "@/server/actions/presenca";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import type { RoundStatus } from "@/lib/supabase/tipos";

export function AcoesDaRodada({
  rodadaId,
  situacao,
  fechamentoSugerido,
}: {
  rodadaId: string;
  situacao: RoundStatus;
  /** Data e hora, no fuso do grupo, para pré-preencher a reabertura. */
  fechamentoSugerido: { data: string; hora: string };
}) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [reabrindo, setReabrindo] = useState(false);
  const [data, setData] = useState(fechamentoSugerido.data);
  const [hora, setHora] = useState(fechamentoSugerido.hora);

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
        <>
          <Botao
            disabled={executando}
            onClick={() => rodar(() => iniciarRodadaAction(rodadaId), "Racha começou!")}
          >
            Iniciar racha
          </Botao>
          <Botao
            variante="contorno"
            disabled={executando}
            onClick={() => setReabrindo((aberto) => !aberto)}
          >
            {reabrindo ? "Deixar fechada" : "Reabrir lista"}
          </Botao>
        </>
      )}

      {situacao === "closed" && reabrindo && (
        <div className="w-full rounded-xl border border-linha bg-carvao/60 p-3">
          <p className="mb-2 text-xs text-cinza">
            A lista volta a aceitar gente até o horário abaixo. Ele precisa ser no futuro: a
            tarefa automática fecha de novo qualquer lista cujo horário já passou.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Campo
              type="date"
              rotulo="Fecha em"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <Campo
              type="time"
              rotulo="Às"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>

          <Botao
            larguraTotal
            className="mt-2"
            disabled={executando || !data || !hora}
            onClick={() =>
              rodar(async () => {
                const r = await reabrirListaAction(rodadaId, data, hora);
                if (r.ok) setReabrindo(false);
                return r;
              }, "Lista reaberta. O grupo foi avisado.")
            }
          >
            Reabrir agora
          </Botao>

          <p className="mt-2 text-[11px] text-cinza-escuro">
            Quem já entrou e os convidados que foram cobrados continuam como estão.
          </p>
        </div>
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
