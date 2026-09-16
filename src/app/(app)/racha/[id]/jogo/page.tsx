import type { Metadata } from "next";
import { exigirUsuario } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { estadoDoJogo } from "@/server/services/partidas";
import { Cronometro } from "@/components/jogo/Cronometro";
import { Placar } from "@/components/jogo/Placar";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";

export const metadata: Metadata = { title: "Jogo ao vivo" };

/** Visão do jogador: acompanha o placar sem poder alterar nada. */
export default async function PaginaJogoAoVivo({ params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;

  const [{ rodada }, estado] = await Promise.all([carregarRodada(id), estadoDoJogo(id)]);
  const partida = estado.partidaAtual;
  const timeA = estado.times.find((t) => t.id === partida?.team_a_id);
  const timeB = estado.times.find((t) => t.id === partida?.team_b_id);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">{nomeDaRodada(rodada)}</p>
        <h1 className="titulo-display text-2xl">
          Jogo <span className="texto-ouro">ao vivo</span>
        </h1>
      </div>

      {partida && timeA && timeB ? (
        <Cartao destaque className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Selo tom="neutro">Partida {partida.seq}</Selo>
            <Selo tom="ouro">
              {estado.golsParaVencer} {estado.golsParaVencer === 1 ? "gol" : "gols"} ·{" "}
              {estado.duracaoEmMinutos} min
            </Selo>
          </div>

          <Cronometro
            comecouEm={partida.started_at}
            duracaoEmMinutos={estado.duracaoEmMinutos}
            rodando={partida.status === "live"}
          />

          <Placar
            timeA={{ name: timeA.name, color: timeA.color }}
            timeB={{ name: timeB.name, color: timeB.color }}
            golsA={partida.score_a}
            golsB={partida.score_b}
          />
        </Cartao>
      ) : (
        <EstadoVazio
          icone="🏟️"
          titulo="Nenhuma partida rolando"
          descricao="Quando o administrador abrir o jogo, o placar aparece aqui ao vivo."
        />
      )}

      {estado.fila.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Próximos a entrar" icone={<span aria-hidden>⏳</span>} />
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
          <CabecalhoCartao titulo="Resultados" />
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
