"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirVotacaoAction,
  marcarPresencaAction,
  marcarTodosPresentesAction,
} from "@/server/actions/estatisticas";
import { Avatar } from "@/components/ui/Avatar";
import { Botao } from "@/components/ui/Botao";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { useToast } from "@/components/ui/Toast";
import { formatarDinheiro } from "@/lib/format";
import type { AttendanceStatus, Profile, RoundParticipant } from "@/lib/supabase/tipos";

export interface LinhaDePresenca {
  participacao: RoundParticipant;
  perfil: Profile;
}

/**
 * Controle de presença pós-racha.
 *
 * O administrador marca quem veio. Para quem faltou, o aplicativo pergunta
 * se a falta foi justificada — justificada não gera multa; sem aviso gera a
 * multa maior, com os valores daquela rodada.
 */
export function ControleDePresenca({
  rodadaId,
  jogadores,
  multaPorFaltaCentavos,
}: {
  rodadaId: string;
  jogadores: LinhaDePresenca[];
  multaPorFaltaCentavos: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [perguntando, setPerguntando] = useState<string | null>(null);

  const marcar = (participacaoId: string, situacao: AttendanceStatus, justificada?: boolean) =>
    iniciar(async () => {
      const resultado = await marcarPresencaAction(rodadaId, {
        participacaoId,
        situacao,
        justificada,
      });

      if (resultado.ok) {
        setPerguntando(null);
        if (situacao === "absent" && justificada === false) {
          toast.mostrar(`Falta sem aviso: multa de ${formatarDinheiro(multaPorFaltaCentavos)}.`, "aviso");
        } else {
          toast.sucesso("Presença registrada.");
        }
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  const pendentes = jogadores.filter((j) => j.participacao.attendance === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      <Cartao>
        <CabecalhoCartao
          titulo={`Controle de presença (${jogadores.length})`}
          acao={
            pendentes > 0 ? (
              <Botao
                tamanho="sm"
                variante="escuro"
                disabled={executando}
                onClick={() =>
                  iniciar(async () => {
                    const resultado = await marcarTodosPresentesAction(rodadaId);
                    if (resultado.ok) {
                      toast.sucesso(`${resultado.dados.marcados} marcado(s) como presente.`);
                      router.refresh();
                    } else {
                      toast.erro(resultado.mensagem);
                    }
                  })
                }
              >
                Todos vieram
              </Botao>
            ) : undefined
          }
        />

        <ul className="flex flex-col divide-y divide-linha">
          {jogadores.map(({ participacao, perfil }) => (
            <li key={participacao.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-center gap-3">
                <Avatar nome={perfil.full_name} fotoUrl={perfil.photo_url} tamanho="sm" goleiro={perfil.is_goalkeeper} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{perfil.full_name}</p>

                {participacao.attendance === "present" && <Selo tom="verde">Compareceu</Selo>}
                {participacao.attendance === "absent" && (
                  <Selo tom={participacao.absence_justified ? "ambar" : "vermelho"}>
                    {participacao.absence_justified ? "Falta justificada" : "Faltou"}
                  </Selo>
                )}
              </div>

              {perguntando === participacao.id ? (
                <div className="flex flex-col gap-2 rounded-xl border border-linha bg-carvao/60 p-3">
                  <p className="text-sm">A falta foi justificada?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Botao
                      variante="sucesso"
                      tamanho="sm"
                      disabled={executando}
                      onClick={() => marcar(participacao.id, "absent", true)}
                    >
                      Justificada
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      disabled={executando}
                      onClick={() => marcar(participacao.id, "absent", false)}
                    >
                      Sem aviso
                    </Botao>
                  </div>
                  <p className="text-[11px] text-cinza-escuro">
                    Justificada não gera multa. Sem aviso gera multa de{" "}
                    {formatarDinheiro(multaPorFaltaCentavos)}.
                  </p>
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setPerguntando(null)}>
                    Cancelar
                  </Botao>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Botao
                    variante={participacao.attendance === "present" ? "sucesso" : "escuro"}
                    tamanho="sm"
                    disabled={executando}
                    onClick={() => marcar(participacao.id, "present")}
                  >
                    Compareceu
                  </Botao>
                  <Botao
                    variante={participacao.attendance === "absent" ? "perigo" : "escuro"}
                    tamanho="sm"
                    disabled={executando}
                    onClick={() => setPerguntando(participacao.id)}
                  >
                    Faltou
                  </Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Cartao>

      <Botao
        variante="contorno"
        larguraTotal
        disabled={executando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await abrirVotacaoAction(rodadaId);
            if (resultado.ok) toast.sucesso("Votação aberta. Quem jogou já foi avisado.");
            else toast.erro(resultado.mensagem);
          })
        }
      >
        Abrir votação de craque e bagre
      </Botao>
    </div>
  );
}
