import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import {
  calcularAproveitamento,
  calcularAssiduidade,
  calcularSequencia,
  ordenarRanking,
  type CriterioDeRanking,
  type LinhaDeRanking,
  type ResumoDeEstatisticas,
  ESTATISTICAS_ZERADAS,
} from "@/domain/estatisticas";
import type { Profile } from "@/lib/supabase/tipos";
import { notasConsolidadas } from "./avaliacoes";
import { temporadaAtual } from "./temporadas";

/**
 * Estatísticas.
 *
 * Os números saem de visões no banco (ver supabase/migrations/0012), nunca
 * de colunas acumuladas. Assim, desfazer um gol, justificar uma falta depois
 * ou corrigir um placar reflete na hora, sem nenhum recálculo manual.
 */

export interface EstatisticasDoJogador extends ResumoDeEstatisticas {
  profileId: string;
  assiduidade: number;
  aproveitamento: number;
  sequenciaAtual: number;
  maiorSequencia: number;
  nota: number;
  temNotaConsolidada: boolean;
}

interface LinhaBrutaDeEstatisticas {
  profile_id: string;
  season_id: string;
  rodadas_aptas: number;
  presencas: number;
  faltas: number;
  faltas_justificadas: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  craques: number;
  bagres: number;
}

/** Sequência de presenças de cada jogador, em ordem cronológica. */
async function sequencias(temporadaId?: string): Promise<Map<string, { atual: number; maior: number }>> {
  let consulta = clienteAdmin()
    .from("v_presencas_em_ordem")
    .select("profile_id, attendance, starts_at, season_id")
    .order("starts_at", { ascending: true });

  if (temporadaId) consulta = consulta.eq("season_id", temporadaId);

  const { data } = await consulta;

  const porJogador = new Map<string, { compareceu: boolean }[]>();
  for (const linha of (data ?? []) as unknown as {
    profile_id: string;
    attendance: string;
  }[]) {
    const lista = porJogador.get(linha.profile_id) ?? [];
    // Quem não teve presença marcada ainda não conta como falta.
    if (linha.attendance === "present" || linha.attendance === "absent") {
      lista.push({ compareceu: linha.attendance === "present" });
    }
    porJogador.set(linha.profile_id, lista);
  }

  const resultado = new Map<string, { atual: number; maior: number }>();
  for (const [profileId, rodadas] of porJogador) {
    resultado.set(profileId, calcularSequencia(rodadas));
  }

  return resultado;
}

/** Estatísticas de todos os jogadores numa temporada (ou de todos os tempos). */
export async function estatisticasDaTemporada(
  temporadaId?: string,
): Promise<Map<string, EstatisticasDoJogador>> {
  let consulta = clienteAdmin().from("v_estatisticas_por_temporada").select("*");
  if (temporadaId) consulta = consulta.eq("season_id", temporadaId);

  const [{ data }, notas, streaks] = await Promise.all([
    consulta,
    notasConsolidadas(),
    sequencias(temporadaId),
  ]);

  const acumulado = new Map<string, EstatisticasDoJogador>();

  for (const bruta of (data ?? []) as unknown as LinhaBrutaDeEstatisticas[]) {
    const atual = acumulado.get(bruta.profile_id);
    const nota = notas.get(bruta.profile_id);
    const streak = streaks.get(bruta.profile_id);

    // Sem filtro de temporada, as linhas de várias temporadas são somadas.
    const somado: ResumoDeEstatisticas = {
      rodadasAptas: (atual?.rodadasAptas ?? 0) + bruta.rodadas_aptas,
      presencas: (atual?.presencas ?? 0) + bruta.presencas,
      faltas: (atual?.faltas ?? 0) + bruta.faltas,
      faltasJustificadas: (atual?.faltasJustificadas ?? 0) + bruta.faltas_justificadas,
      gols: (atual?.gols ?? 0) + Number(bruta.gols),
      assistencias: (atual?.assistencias ?? 0) + Number(bruta.assistencias),
      vitorias: (atual?.vitorias ?? 0) + bruta.vitorias,
      derrotas: (atual?.derrotas ?? 0) + bruta.derrotas,
      empates: (atual?.empates ?? 0) + bruta.empates,
      craques: (atual?.craques ?? 0) + bruta.craques,
      bagres: (atual?.bagres ?? 0) + bruta.bagres,
    };

    acumulado.set(bruta.profile_id, {
      profileId: bruta.profile_id,
      ...somado,
      assiduidade: calcularAssiduidade(somado.presencas, somado.rodadasAptas),
      aproveitamento: calcularAproveitamento(somado.vitorias, somado.empates, somado.derrotas),
      sequenciaAtual: streak?.atual ?? 0,
      maiorSequencia: streak?.maior ?? 0,
      nota: nota?.nota ?? 0,
      temNotaConsolidada: nota?.temVotosSuficientes ?? false,
    });
  }

  return acumulado;
}

export async function estatisticasDoJogador(
  profileId: string,
  temporadaId?: string,
): Promise<EstatisticasDoJogador> {
  const todas = await estatisticasDaTemporada(temporadaId);

  return (
    todas.get(profileId) ?? {
      profileId,
      ...ESTATISTICAS_ZERADAS,
      assiduidade: 0,
      aproveitamento: 0,
      sequenciaAtual: 0,
      maiorSequencia: 0,
      nota: 0,
      temNotaConsolidada: false,
    }
  );
}

export interface LinhaDoRanking extends LinhaDeRanking {
  jogador: Profile;
  estatisticas: EstatisticasDoJogador;
}

/** Ranking pronto para a tela, já ordenado pelo critério escolhido. */
export async function montarRanking(
  criterio: CriterioDeRanking = "presencas",
  temporadaId?: string,
): Promise<LinhaDoRanking[]> {
  const temporada = temporadaId ?? (await temporadaAtual())?.id;

  const [estatisticas, { data: jogadores }] = await Promise.all([
    estatisticasDaTemporada(temporada),
    clienteAdmin().from("profiles").select("*").neq("status", "banned"),
  ]);

  const linhas: LinhaDoRanking[] = (jogadores ?? []).map((jogador) => {
    const dele = estatisticas.get(jogador.id) ?? {
      profileId: jogador.id,
      ...ESTATISTICAS_ZERADAS,
      assiduidade: 0,
      aproveitamento: 0,
      sequenciaAtual: 0,
      maiorSequencia: 0,
      nota: 0,
      temNotaConsolidada: false,
    };

    return {
      profileId: jogador.id,
      presencas: dele.presencas,
      assiduidade: dele.assiduidade,
      gols: dele.gols,
      assistencias: dele.assistencias,
      vitorias: dele.vitorias,
      nota: dele.nota,
      craques: dele.craques,
      jogador,
      estatisticas: dele,
    };
  });

  return ordenarRanking(linhas, criterio) as LinhaDoRanking[];
}
