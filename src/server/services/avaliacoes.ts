import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { podeAvaliar } from "@/domain/avaliacoes";
import type { Profile } from "@/lib/supabase/tipos";
import { lerConfiguracoes } from "./configuracoes";

/**
 * Avaliações dos jogadores.
 *
 * O voto é anônimo de verdade: a coluna com o autor nunca sai do servidor
 * para um cliente comum. A interface trabalha sempre com a média agregada,
 * lida das visões v_player_rating e v_player_effective_rating, que não
 * carregam quem votou.
 */

export interface NotaDoJogador {
  profileId: string;
  nota: number;
  votos: number;
  temVotosSuficientes: boolean;
}

/** Notas consolidadas de todos os jogadores, já com mínimo de votos aplicado. */
export async function notasConsolidadas(): Promise<Map<string, NotaDoJogador>> {
  const { data } = await clienteAdmin().from("v_player_effective_rating").select("*");

  const mapa = new Map<string, NotaDoJogador>();
  for (const linha of data ?? []) {
    mapa.set(linha.profile_id, {
      profileId: linha.profile_id,
      nota: Number(linha.rating),
      votos: linha.votes_count,
      temVotosSuficientes: linha.has_enough_votes,
    });
  }

  return mapa;
}

export async function notaDoJogador(profileId: string): Promise<NotaDoJogador> {
  const configuracoes = await lerConfiguracoes();

  const { data } = await clienteAdmin()
    .from("v_player_effective_rating")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data) {
    return {
      profileId,
      nota: configuracoes.default_rating,
      votos: 0,
      temVotosSuficientes: false,
    };
  }

  return {
    profileId,
    nota: Number(data.rating),
    votos: data.votes_count,
    temVotosSuficientes: data.has_enough_votes,
  };
}

/** Registra (ou atualiza) a avaliação que o jogador deu a um colega. */
export async function avaliarJogador(
  votante: Profile,
  avaliadoId: string,
  nota: number,
): Promise<void> {
  const veredito = podeAvaliar({
    votanteId: votante.id,
    avaliadoId,
    votanteEstaAtivo: votante.status === "active",
    nota,
  });

  if (!veredito.permitido) {
    throw erroDeRegra("regra_violada", veredito.motivo ?? "Não foi possível registrar sua avaliação.");
  }

  const { error } = await clienteAdmin()
    .from("player_rating_votes")
    .upsert(
      { voter_id: votante.id, target_id: avaliadoId, score: nota },
      { onConflict: "voter_id,target_id" },
    );

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível registrar sua avaliação agora.");
  }
}

/**
 * As notas que ESTE jogador deu — para a tela poder mostrar o que ele já
 * avaliou. Nunca revela as notas dadas por outras pessoas.
 */
export async function minhasAvaliacoes(votanteId: string): Promise<Map<string, number>> {
  const { data } = await clienteAdmin()
    .from("player_rating_votes")
    .select("target_id, score")
    .eq("voter_id", votanteId);

  return new Map((data ?? []).map((voto) => [voto.target_id, Number(voto.score)]));
}

export async function removerAvaliacao(votanteId: string, avaliadoId: string): Promise<void> {
  await clienteAdmin()
    .from("player_rating_votes")
    .delete()
    .eq("voter_id", votanteId)
    .eq("target_id", avaliadoId);
}
