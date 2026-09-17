import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { estatisticasDaTemporada, type EstatisticasDoJogador } from "./estatisticas";
import { listarTemporadas } from "./temporadas";
import type { Profile, Season } from "@/lib/supabase/tipos";

/**
 * Hall da Fama e Resenha do ano.
 *
 * Tudo é derivado das mesmas visões de estatística, então nenhum número aqui
 * pode divergir do ranking. O histórico antigo nunca é apagado: uma
 * temporada encerrada continua consultável para sempre.
 */

export interface DestaqueDoAno {
  chave: string;
  titulo: string;
  emoji: string;
  /** Texto do valor já formatado para a tela. */
  valor: string;
  jogador: Profile | null;
}

export interface Resenha {
  temporada: Season | null;
  totalDeRodadas: number;
  totalDeGols: number;
  totalDeJogadores: number;
  destaques: DestaqueDoAno[];
  ranking: { jogador: Profile; estatisticas: EstatisticasDoJogador }[];
}

interface Criterio {
  chave: string;
  titulo: string;
  emoji: string;
  valor: (e: EstatisticasDoJogador) => number;
  formatar: (e: EstatisticasDoJogador) => string;
  /** Quando o destaque é "pior é melhor" (bagre do ano). */
  maiorEMelhor?: boolean;
}

const CRITERIOS: Criterio[] = [
  {
    chave: "artilheiro",
    titulo: "Artilheiro",
    emoji: "⚽",
    valor: (e) => e.gols,
    formatar: (e) => `${e.gols} ${e.gols === 1 ? "gol" : "gols"}`,
  },
  {
    chave: "garcom",
    titulo: "Maior assistente",
    emoji: "🎩",
    valor: (e) => e.assistencias,
    formatar: (e) => `${e.assistencias} ${e.assistencias === 1 ? "assistência" : "assistências"}`,
  },
  {
    chave: "craque",
    titulo: "Craque do ano",
    emoji: "🏆",
    valor: (e) => e.craques,
    formatar: (e) => `${e.craques} ${e.craques === 1 ? "eleição" : "eleições"}`,
  },
  {
    chave: "assiduo",
    titulo: "Mais assíduo",
    emoji: "📅",
    valor: (e) => e.assiduidade,
    formatar: (e) => `${(e.assiduidade * 100).toFixed(0)}% de presença`,
  },
  {
    chave: "sequencia",
    titulo: "Maior sequência",
    emoji: "🔥",
    valor: (e) => e.maiorSequencia,
    formatar: (e) => `${e.maiorSequencia} rachas seguidos`,
  },
  {
    chave: "vitorias",
    titulo: "Mais vitórias",
    emoji: "🏅",
    valor: (e) => e.vitorias,
    formatar: (e) => `${e.vitorias} ${e.vitorias === 1 ? "vitória" : "vitórias"}`,
  },
  {
    chave: "presenca",
    titulo: "Mais jogos",
    emoji: "👟",
    valor: (e) => e.presencas,
    formatar: (e) => `${e.presencas} ${e.presencas === 1 ? "jogo" : "jogos"}`,
  },
  {
    chave: "nota",
    titulo: "Melhor média",
    emoji: "⭐",
    valor: (e) => (e.temNotaConsolidada ? e.nota : 0),
    formatar: (e) => `nota ${e.nota.toFixed(1).replace(".", ",")}`,
  },
  {
    chave: "bagre",
    titulo: "Bagre do ano",
    emoji: "🥔",
    valor: (e) => e.bagres,
    formatar: (e) => `${e.bagres} ${e.bagres === 1 ? "eleição" : "eleições"}`,
  },
];

/**
 * Monta a retrospectiva de uma temporada.
 *
 * Um destaque sem ninguém pontuando fica com jogador nulo — a tela mostra
 * "ninguém ainda" em vez de inventar um vencedor com zero.
 */
export async function montarResenha(temporadaId?: string): Promise<Resenha> {
  const temporadas = await listarTemporadas();
  const temporada = temporadaId
    ? (temporadas.find((t) => t.id === temporadaId) ?? null)
    : (temporadas.find((t) => t.is_current) ?? temporadas[0] ?? null);

  const estatisticas = await estatisticasDaTemporada(temporada?.id);
  const admin = clienteAdmin();

  const { data: jogadores } = await admin
    .from("profiles")
    .select("*")
    .in("id", [...estatisticas.keys()].length > 0 ? [...estatisticas.keys()] : ["sem-jogadores"]);

  const porId = new Map((jogadores ?? []).map((j) => [j.id, j]));

  const destaques: DestaqueDoAno[] = CRITERIOS.map((criterio) => {
    let melhor: EstatisticasDoJogador | null = null;

    for (const dele of estatisticas.values()) {
      const valor = criterio.valor(dele);
      if (valor <= 0) continue;
      if (!melhor || valor > criterio.valor(melhor)) melhor = dele;
    }

    return {
      chave: criterio.chave,
      titulo: criterio.titulo,
      emoji: criterio.emoji,
      valor: melhor ? criterio.formatar(melhor) : "ninguém ainda",
      jogador: melhor ? (porId.get(melhor.profileId) ?? null) : null,
    };
  });

  let consultaDeRodadas = admin
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("status", "finished");

  if (temporada) consultaDeRodadas = consultaDeRodadas.eq("season_id", temporada.id);
  const { count: totalDeRodadas } = await consultaDeRodadas;

  const ranking = [...estatisticas.values()]
    .map((dele) => ({ jogador: porId.get(dele.profileId), estatisticas: dele }))
    .filter((linha): linha is { jogador: Profile; estatisticas: EstatisticasDoJogador } =>
      Boolean(linha.jogador),
    )
    .sort((a, b) => b.estatisticas.presencas - a.estatisticas.presencas);

  return {
    temporada,
    totalDeRodadas: totalDeRodadas ?? 0,
    totalDeGols: [...estatisticas.values()].reduce((soma, e) => soma + e.gols, 0),
    totalDeJogadores: ranking.filter((l) => l.estatisticas.presencas > 0).length,
    destaques,
    ranking,
  };
}

export interface LinhaDoHallDaFama {
  chave: string;
  titulo: string;
  emoji: string;
  /** Os melhores de todos os tempos, do primeiro ao terceiro. */
  podio: { jogador: Profile; valor: string }[];
}

/** Hall da Fama: os maiores de todos os tempos, somando todas as temporadas. */
export async function montarHallDaFama(): Promise<LinhaDoHallDaFama[]> {
  // Sem filtro de temporada, as estatísticas somam a história inteira.
  const estatisticas = await estatisticasDaTemporada();

  const { data: jogadores } = await clienteAdmin()
    .from("profiles")
    .select("*")
    .in("id", [...estatisticas.keys()].length > 0 ? [...estatisticas.keys()] : ["sem-jogadores"]);

  const porId = new Map((jogadores ?? []).map((j) => [j.id, j]));

  return CRITERIOS.filter((c) => c.chave !== "bagre").map((criterio) => ({
    chave: criterio.chave,
    titulo: criterio.titulo,
    emoji: criterio.emoji,
    podio: [...estatisticas.values()]
      .filter((dele) => criterio.valor(dele) > 0 && porId.has(dele.profileId))
      .sort((a, b) => criterio.valor(b) - criterio.valor(a))
      .slice(0, 3)
      .map((dele) => ({
        jogador: porId.get(dele.profileId) as Profile,
        valor: criterio.formatar(dele),
      })),
  }));
}
