"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  desfazerGolAction,
  encerrarPartidaAction,
  iniciarCronometroAction,
  registrarGolAction,
} from "@/server/actions/partidas";
import { Botao } from "@/components/ui/Botao";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import { Cronometro } from "./Cronometro";
import { Placar } from "./Placar";
import type { EstadoDoJogo } from "@/server/services/partidas";
import { cn } from "@/lib/utils";

/**
 * Modo jogo.
 *
 * Registrar gol é opcional: dá para marcar "gol do time" sem escolher o
 * autor, que é como acontece quando ninguém lembra quem fez. O que o grupo
 * não registrar, o sistema não inventa.
 */
export function ModoJogo({ rodadaId, estado }: { rodadaId: string; estado: EstadoDoJogo }) {
  const toast = useToast();
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [escolhendoGol, setEscolhendoGol] = useState<string | null>(null);

  const partida = estado.partidaAtual;
  const timeA = estado.times.find((t) => t.id === partida?.team_a_id);
  const timeB = estado.times.find((t) => t.id === partida?.team_b_id);

  // O goleiro é do gol, não do time: quem está em cada lado vem da partida.
  const nomeDoGoleiro = (participacaoId: string | null | undefined) =>
    estado.goleiros.find((g) => g.participacaoId === participacaoId)?.nome ?? null;

  if (!partida || !timeA || !timeB) {
    return (
      <EstadoVazio
        icone="🎽"
        titulo="Nenhuma partida em andamento"
        descricao="Gere os times e abra o jogo para começar."
      />
    );
  }

  const rodando = partida.status === "live";
  const golsDaPartida = estado.eventos.filter(
    (e) => e.match_id === partida.id && (e.kind === "goal" || e.kind === "own_goal"),
  );

  const marcarGol = (timeId: string, participacaoId: string | null, convidadoId: string | null) =>
    iniciar(async () => {
      const resultado = await registrarGolAction(rodadaId, {
        partidaId: partida.id,
        timeId,
        participacaoId,
        convidadoId,
      });

      if (resultado.ok) {
        toast.sucesso("GOOOOL! ⚽");
        setEscolhendoGol(null);
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  const encerrar = () =>
    iniciar(async () => {
      const resultado = await encerrarPartidaAction(rodadaId, partida.id);
      if (resultado.ok) {
        toast.sucesso(resultado.dados.explicacao);
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <Cartao destaque className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Selo tom="neutro">Partida {partida.seq}</Selo>
          <Selo tom="ouro">
            {estado.golsParaVencer} {estado.golsParaVencer === 1 ? "gol" : "gols"} · {estado.duracaoEmMinutos} min
          </Selo>
        </div>

        <Cronometro comecouEm={partida.started_at} duracaoEmMinutos={estado.duracaoEmMinutos} rodando={rodando} />

        <Placar
          timeA={{ name: timeA.name, color: timeA.color }}
          timeB={{ name: timeB.name, color: timeB.color }}
          golsA={partida.score_a}
          golsB={partida.score_b}
          goleiroA={nomeDoGoleiro(partida.goalkeeper_a_id)}
          goleiroB={nomeDoGoleiro(partida.goalkeeper_b_id)}
        />

        {!rodando ? (
          <Botao
            tamanho="xl"
            larguraTotal
            carregando={executando}
            onClick={() =>
              iniciar(async () => {
                const resultado = await iniciarCronometroAction(rodadaId, partida.id);
                if (resultado.ok) router.refresh();
                else toast.erro(resultado.mensagem);
              })
            }
          >
            Começar partida
          </Botao>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[timeA, timeB].map((time) => (
              <Botao
                key={time.id}
                tamanho="lg"
                variante={escolhendoGol === time.id ? "contorno" : "ouro"}
                disabled={executando}
                onClick={() => setEscolhendoGol(escolhendoGol === time.id ? null : time.id)}
              >
                Gol {time.name.replace("Time ", "")}
              </Botao>
            ))}
          </div>
        )}
      </Cartao>

      {escolhendoGol && (
        <Cartao className="animate-subir">
          <CabecalhoCartao titulo="Quem fez o gol?" icone={<span aria-hidden>⚽</span>} />

          <div className="flex flex-col gap-2">
            {(escolhendoGol === timeA.id ? timeA : timeB).integrantes.map((integrante) => (
              <button
                key={integrante.id}
                type="button"
                disabled={executando}
                onClick={() =>
                  marcarGol(escolhendoGol, integrante.participant_id, integrante.guest_id)
                }
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3",
                  "text-left text-sm transition-colors hover:border-ouro/40 active:scale-[0.99]",
                )}
              >
                <span aria-hidden>{integrante.ehGoleiro ? "🧤" : "⚽"}</span>
                <span className="flex-1 truncate">{integrante.nome}</span>
              </button>
            ))}

            <Botao
              variante="escuro"
              larguraTotal
              disabled={executando}
              onClick={() => marcarGol(escolhendoGol, null, null)}
            >
              Não sei quem fez
            </Botao>

            <Botao variante="fantasma" larguraTotal onClick={() => setEscolhendoGol(null)}>
              Cancelar
            </Botao>
          </div>
        </Cartao>
      )}

      {rodando && (
        <Botao variante="perigo" tamanho="lg" larguraTotal carregando={executando} onClick={encerrar}>
          Encerrar partida
        </Botao>
      )}

      {golsDaPartida.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Gols desta partida" />
          <ul className="flex flex-col divide-y divide-linha">
            {golsDaPartida.map((gol) => {
              const time = estado.times.find((t) => t.id === gol.team_id);
              const autor = time?.integrantes.find(
                (i) =>
                  (gol.participant_id && i.participant_id === gol.participant_id) ||
                  (gol.guest_id && i.guest_id === gol.guest_id),
              );

              return (
                <li key={gol.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span aria-hidden>{gol.kind === "own_goal" ? "😅" : "⚽"}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {autor?.nome ?? "Autor não registrado"}
                    <span className="ml-1.5 text-xs text-cinza-escuro">{time?.name}</span>
                  </span>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    disabled={executando}
                    onClick={() =>
                      iniciar(async () => {
                        const resultado = await desfazerGolAction(rodadaId, gol.id);
                        if (resultado.ok) {
                          toast.mostrar("Gol desfeito.", "aviso");
                          router.refresh();
                        } else {
                          toast.erro(resultado.mensagem);
                        }
                      })
                    }
                  >
                    Desfazer
                  </Botao>
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}

      {estado.fila.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Esperando para entrar" icone={<span aria-hidden>⏳</span>} />
          <ol className="flex flex-col gap-2">
            {estado.fila.map((time, indice) => (
              <li key={time.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-xs font-bold text-cinza-escuro">{indice + 1}</span>
                <span className="flex-1">{time.name}</span>
              </li>
            ))}
          </ol>
        </Cartao>
      )}

      {estado.partidas.filter((p) => p.status === "finished").length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Partidas encerradas" />
          <ul className="flex flex-col divide-y divide-linha">
            {estado.partidas
              .filter((p) => p.status === "finished")
              .map((p) => {
                const a = estado.times.find((t) => t.id === p.team_a_id);
                const b = estado.times.find((t) => t.id === p.team_b_id);

                return (
                  <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-6 text-xs text-cinza-escuro">#{p.seq}</span>
                    <span className="flex-1 truncate">
                      {a?.name} {p.score_a} × {p.score_b} {b?.name}
                    </span>
                    {p.tiebreak && <Selo tom="ambar">Sorteio</Selo>}
                  </li>
                );
              })}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
