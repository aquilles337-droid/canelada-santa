import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/sessao";
import { montarRanking } from "@/server/services/estatisticas";
import { temporadaAtual } from "@/server/services/temporadas";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarNota, formatarPercentual } from "@/lib/format";
import type { CriterioDeRanking } from "@/domain/estatisticas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ranking" };

const CRITERIOS: { chave: CriterioDeRanking; rotulo: string; emoji: string }[] = [
  { chave: "presencas", rotulo: "Presenças", emoji: "📋" },
  { chave: "gols", rotulo: "Gols", emoji: "⚽" },
  { chave: "assistencias", rotulo: "Assist.", emoji: "🎩" },
  { chave: "vitorias", rotulo: "Vitórias", emoji: "🏅" },
  { chave: "assiduidade", rotulo: "Assiduidade", emoji: "🔥" },
  { chave: "nota", rotulo: "Nota", emoji: "⭐" },
  { chave: "craques", rotulo: "Craques", emoji: "🏆" },
];

const MEDALHAS = ["🥇", "🥈", "🥉"];

function valorDoCriterio(
  criterio: CriterioDeRanking,
  linha: { presencas: number; gols: number; assistencias: number; vitorias: number; assiduidade: number; nota: number; craques: number },
): string {
  switch (criterio) {
    case "assiduidade":
      return formatarPercentual(linha.assiduidade);
    case "nota":
      return formatarNota(linha.nota);
    default:
      return String(linha[criterio]);
  }
}

export default async function PaginaRanking({
  searchParams,
}: {
  searchParams: Promise<{ por?: string }>;
}) {
  const perfil = await exigirUsuario();
  const { por } = await searchParams;

  const criterio = (CRITERIOS.find((c) => c.chave === por)?.chave ?? "presencas") as CriterioDeRanking;
  const [linhas, temporada] = await Promise.all([montarRanking(criterio), temporadaAtual()]);

  const comAlgumaAtividade = linhas.filter((l) => l.estatisticas.rodadasAptas > 0);
  const minhaPosicao = linhas.findIndex((l) => l.profileId === perfil.id) + 1;

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="titulo-display text-2xl">
            Ranking <span className="texto-ouro">{temporada?.name.replace("Temporada ", "") ?? ""}</span>
          </h1>
          <p className="text-xs text-cinza">Assiduidade é resenha — ela não decide vaga no racha.</p>
        </div>
        {minhaPosicao > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-cinza">Você</p>
            <p className="titulo-display text-2xl texto-ouro">#{minhaPosicao}</p>
          </div>
        )}
      </div>

      <nav className="rolagem-invisivel -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CRITERIOS.map((item) => (
          <Link
            key={item.chave}
            href={`/ranking?por=${item.chave}`}
            scroll={false}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              item.chave === criterio
                ? "border-ouro/50 bg-ouro/15 text-ouro-claro"
                : "border-linha bg-carvao/60 text-cinza hover:text-osso",
            )}
          >
            <span aria-hidden className="mr-1">
              {item.emoji}
            </span>
            {item.rotulo}
          </Link>
        ))}
      </nav>

      {comAlgumaAtividade.length === 0 ? (
        <EstadoVazio
          icone="📊"
          titulo="Ranking ainda vazio"
          descricao="Assim que o primeiro racha for finalizado, os números aparecem aqui."
        />
      ) : (
        <Cartao className="p-0">
          <ol className="flex flex-col divide-y divide-linha">
            {comAlgumaAtividade.map((linha, indice) => {
              const souEu = linha.profileId === perfil.id;

              return (
                <li
                  key={linha.profileId}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    souEu && "bg-ouro/5",
                  )}
                >
                  <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">
                    {indice < 3 ? (
                      <span aria-hidden className="text-lg">
                        {MEDALHAS[indice]}
                      </span>
                    ) : (
                      <span className="text-cinza-escuro">{indice + 1}</span>
                    )}
                  </span>

                  <Avatar
                    nome={linha.jogador.full_name}
                    fotoUrl={linha.jogador.photo_url}
                    tamanho="sm"
                    goleiro={linha.jogador.is_goalkeeper}
                  />

                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", souEu ? "font-bold" : "font-medium")}>
                      {linha.jogador.nickname?.trim() || linha.jogador.full_name}
                    </p>
                    <p className="text-[11px] text-cinza-escuro">
                      {linha.estatisticas.presencas} jogos ·{" "}
                      {formatarPercentual(linha.estatisticas.assiduidade)} de presença
                      {linha.estatisticas.sequenciaAtual > 1 && (
                        <span className="ml-1 text-ambar">🔥 {linha.estatisticas.sequenciaAtual}</span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="titulo-display text-lg tabular-nums texto-ouro">
                      {valorDoCriterio(criterio, linha)}
                    </p>
                    {criterio === "nota" && !linha.estatisticas.temNotaConsolidada && (
                      <Selo tom="neutro">sem votos</Selo>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Cartao>
      )}
    </div>
  );
}
