import type { Metadata } from "next";
import { exigirUsuario } from "@/server/auth/sessao";
import { montarHallDaFama } from "@/server/services/hallDaFama";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { Brasao } from "@/components/brand/Brasao";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hall da Fama" };

const MEDALHAS = ["🥇", "🥈", "🥉"];

/** Os maiores de todos os tempos. Nada aqui é apagado na virada de temporada. */
export default async function PaginaHallDaFama() {
  await exigirUsuario();
  const linhas = await montarHallDaFama();
  const comDados = linhas.filter((linha) => linha.podio.length > 0);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <Brasao tamanho={92} />
        <div>
          <h1 className="titulo-display text-2xl">
            Hall da <span className="texto-ouro">Fama</span>
          </h1>
          <p className="mt-1 text-xs text-cinza">
            Todos os tempos. A virada de temporada nunca apaga o que já aconteceu.
          </p>
        </div>
      </div>

      {comDados.length === 0 ? (
        <EstadoVazio
          icone="🏛️"
          titulo="A história começa agora"
          descricao="Assim que os primeiros rachas forem finalizados, os nomes aparecem aqui."
        />
      ) : (
        comDados.map((linha) => (
          <Cartao key={linha.chave}>
            <h2 className="titulo-display mb-3 flex items-center gap-2 text-sm text-cinza">
              <span aria-hidden>{linha.emoji}</span>
              {linha.titulo}
            </h2>

            <ol className="flex flex-col divide-y divide-linha">
              {linha.podio.map((posicao, indice) => (
                <li key={posicao.jogador.id} className="flex items-center gap-3 py-2.5">
                  <span aria-hidden className="w-7 text-center text-lg">
                    {MEDALHAS[indice]}
                  </span>
                  <Avatar
                    nome={posicao.jogador.full_name}
                    fotoUrl={posicao.jogador.photo_url}
                    tamanho="sm"
                    goleiro={posicao.jogador.is_goalkeeper}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      indice === 0 ? "font-bold" : "font-medium",
                    )}
                  >
                    {posicao.jogador.nickname?.trim() || posicao.jogador.full_name}
                  </span>
                  <span className="shrink-0 text-xs text-cinza">{posicao.valor}</span>
                </li>
              ))}
            </ol>
          </Cartao>
        ))
      )}
    </div>
  );
}
