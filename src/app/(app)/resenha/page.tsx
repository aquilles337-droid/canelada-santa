import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/sessao";
import { montarResenha } from "@/server/services/hallDaFama";
import { listarTemporadas } from "@/server/services/temporadas";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { Brasao } from "@/components/brand/Brasao";
import { formatarPercentual, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resenha" };

/** Retrospectiva da temporada — a resenha de fim de ano do grupo. */
export default async function PaginaResenha({
  searchParams,
}: {
  searchParams: Promise<{ temporada?: string }>;
}) {
  await exigirUsuario();
  const { temporada: temporadaEscolhida } = await searchParams;

  const [resenha, temporadas] = await Promise.all([
    montarResenha(temporadaEscolhida),
    listarTemporadas(),
  ]);

  const nome = resenha.temporada?.name ?? "Canelada Santa";

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="superficie relative overflow-hidden p-5 text-center">
        <span aria-hidden className="faixa-diagonal pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex flex-col items-center gap-3">
          <Brasao tamanho={88} />
          <p className="text-[11px] uppercase tracking-[0.35em] text-cinza">Resenha</p>
          <h1 className="titulo-display text-3xl">
            <span className="texto-ouro">{nome}</span>
          </h1>

          <div className="mt-2 grid w-full grid-cols-3 gap-2">
            {[
              { rotulo: "Rachas", valor: resenha.totalDeRodadas },
              { rotulo: "Gols", valor: resenha.totalDeGols },
              { rotulo: "Jogadores", valor: resenha.totalDeJogadores },
            ].map((item) => (
              <div key={item.rotulo}>
                <p className="titulo-display text-2xl">{item.valor}</p>
                <p className="text-[10px] uppercase tracking-wider text-cinza">{item.rotulo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {temporadas.length > 1 && (
        <nav className="rolagem-invisivel -mx-4 flex gap-2 overflow-x-auto px-4">
          {temporadas.map((t) => (
            <Link
              key={t.id}
              href={`/resenha?temporada=${t.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                t.id === resenha.temporada?.id
                  ? "border-ouro/50 bg-ouro/15 text-ouro-claro"
                  : "border-linha bg-carvao/60 text-cinza hover:text-osso",
              )}
            >
              {t.name.replace("Temporada ", "")}
            </Link>
          ))}
        </nav>
      )}

      {resenha.totalDeRodadas === 0 ? (
        <EstadoVazio
          icone="📽️"
          titulo="A temporada mal começou"
          descricao="Quando os rachas forem acontecendo, a retrospectiva se monta sozinha aqui."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {resenha.destaques.map((destaque) => (
              <Cartao
                key={destaque.chave}
                className="flex flex-col items-center gap-2 p-3 text-center"
                destaque={destaque.chave === "craque"}
              >
                <span aria-hidden className="text-2xl">
                  {destaque.emoji}
                </span>
                <p className="text-[10px] uppercase tracking-wider text-cinza">{destaque.titulo}</p>

                {destaque.jogador ? (
                  <>
                    <Avatar
                      nome={destaque.jogador.full_name}
                      fotoUrl={destaque.jogador.photo_url}
                      tamanho="md"
                      goleiro={destaque.jogador.is_goalkeeper}
                    />
                    <p className="titulo-display w-full truncate text-sm">
                      {destaque.jogador.nickname?.trim() || destaque.jogador.full_name}
                    </p>
                    <Selo tom="neutro">{destaque.valor}</Selo>
                  </>
                ) : (
                  <p className="py-4 text-xs text-cinza-escuro">ninguém ainda</p>
                )}
              </Cartao>
            ))}
          </div>

          <Cartao>
            <h2 className="titulo-display mb-3 text-sm text-cinza">Todo mundo na temporada</h2>
            <ol className="flex flex-col divide-y divide-linha">
              {resenha.ranking
                .filter((linha) => linha.estatisticas.presencas > 0)
                .map((linha, indice) => (
                  <li key={linha.jogador.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 text-right text-xs font-bold text-cinza-escuro tabular-nums">
                      {indice + 1}
                    </span>
                    <Avatar
                      nome={linha.jogador.full_name}
                      fotoUrl={linha.jogador.photo_url}
                      tamanho="sm"
                      goleiro={linha.jogador.is_goalkeeper}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {linha.jogador.nickname?.trim() || linha.jogador.full_name}
                      </p>
                      <p className="text-[11px] text-cinza-escuro">
                        {plural(linha.estatisticas.presencas, "jogo", "jogos")} ·{" "}
                        {formatarPercentual(linha.estatisticas.assiduidade)} ·{" "}
                        {plural(linha.estatisticas.gols, "gol", "gols")}
                      </p>
                    </div>
                    {linha.estatisticas.craques > 0 && (
                      <Selo tom="ouro">🏆 {linha.estatisticas.craques}</Selo>
                    )}
                  </li>
                ))}
            </ol>
          </Cartao>
        </>
      )}
    </div>
  );
}
