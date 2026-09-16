"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarVagaAction,
  cancelarPresencaAction,
  confirmarPresencaAction,
} from "@/server/actions/presenca";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { tempoAte } from "@/lib/format";
import type { ParticipationStatus } from "@/lib/supabase/tipos";

export interface EstadoDePresenca {
  situacao: ParticipationStatus | null;
  posicaoNaEspera: number | null;
  conviteExpiraEm: string | null;
  podeEntrar: boolean;
  motivo: string | null;
}

/**
 * O par de botoes VOU / NÃO VOU.
 *
 * O que aparece muda conforme a situacao: quem esta fora ve VOU; quem esta
 * dentro ve a confirmacao e a opcao de retirar o nome; quem foi chamado da
 * fila ve o prazo correndo.
 */
export function BotoesDePresenca({
  rodadaId,
  estado,
}: {
  rodadaId: string;
  estado: EstadoDePresenca;
}) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  const confirmar = () =>
    iniciar(async () => {
      const resultado = await confirmarPresencaAction(rodadaId);
      if (resultado.ok) {
        toast.sucesso(resultado.dados.mensagem);
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  const cancelar = () =>
    iniciar(async () => {
      const resultado = await cancelarPresencaAction(rodadaId);
      if (resultado.ok) {
        toast.mostrar(resultado.dados.mensagem, "aviso");
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  const aceitar = () =>
    iniciar(async () => {
      const resultado = await aceitarVagaAction(rodadaId);
      if (resultado.ok) {
        toast.sucesso(resultado.dados.mensagem);
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  // Chamado da fila: o prazo esta correndo.
  if (estado.situacao === "invited") {
    return (
      <div className="flex flex-col gap-2">
        <div className="animate-pulsar-ouro rounded-xl border border-ouro/50 bg-ouro/10 px-4 py-3 text-center">
          <p className="titulo-display text-base text-ouro-claro">Abriu uma vaga para você!</p>
          {estado.conviteExpiraEm && (
            <p className="mt-0.5 text-xs text-cinza">
              Confirme {tempoAte(estado.conviteExpiraEm)} ou a vaga passa para o próximo.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Botao tamanho="lg" carregando={executando} onClick={aceitar}>
            Quero a vaga
          </Botao>
          <Botao variante="escuro" tamanho="lg" disabled={executando} onClick={cancelar}>
            Não vou
          </Botao>
        </div>
      </div>
    );
  }

  if (estado.situacao === "confirmed") {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-verde/40 bg-verde/10 px-4 py-3 text-center">
          <p className="titulo-display text-base text-verde">Presença confirmada</p>
          <p className="mt-0.5 text-xs text-cinza">Te esperamos na quadra.</p>
        </div>
        <Botao variante="fantasma" tamanho="md" larguraTotal disabled={executando} onClick={cancelar}>
          Retirar meu nome
        </Botao>
      </div>
    );
  }

  if (estado.situacao === "waiting") {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-ambar/40 bg-ambar/10 px-4 py-3 text-center">
          <p className="titulo-display text-base text-ambar">
            {estado.posicaoNaEspera ? `${estado.posicaoNaEspera}º na espera` : "Na lista de espera"}
          </p>
          <p className="mt-0.5 text-xs text-cinza">Se abrir vaga, avisamos na hora.</p>
        </div>
        <Botao variante="fantasma" tamanho="md" larguraTotal disabled={executando} onClick={cancelar}>
          Sair da espera
        </Botao>
      </div>
    );
  }

  if (!estado.podeEntrar) {
    return (
      <div className="rounded-xl border border-linha bg-elevado/60 px-4 py-3 text-center">
        <p className="text-sm text-cinza">{estado.motivo ?? "Não é possível entrar neste racha."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Botao tamanho="xl" carregando={executando} onClick={confirmar}>
        Vou
      </Botao>
      <Botao variante="escuro" tamanho="xl" disabled={executando} onClick={cancelar}>
        Não vou
      </Botao>
    </div>
  );
}
