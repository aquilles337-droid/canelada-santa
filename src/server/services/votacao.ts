import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { apurarVotos, podeVotarNaRodada } from "@/domain/avaliacoes";
import type { Profile, VoteKind } from "@/lib/supabase/tipos";
import { carregarRodada } from "./rodadas";

/**
 * Craque e bagre da rodada.
 *
 * Só quem jogou vota, ninguém vota em si mesmo, e o voto é anônimo: a tela
 * recebe apenas a contagem por jogador, nunca quem escolheu quem.
 */

export interface ApuracaoDaRodada {
  tipo: VoteKind;
  contagem: { profileId: string; nome: string; fotoUrl: string | null; votos: number }[];
  vencedorId: string | null;
  empate: boolean;
  totalDeVotos: number;
}

export async function registrarVoto(
  rodadaId: string,
  votante: Profile,
  escolhidoId: string,
  tipo: VoteKind,
): Promise<void> {
  const { rodada, participantes } = await carregarRodada(rodadaId);

  const votanteJogou = participantes.some(
    (p) => p.profile_id === votante.id && p.attendance === "present",
  );
  const escolhidoJogou = participantes.some(
    (p) => p.profile_id === escolhidoId && p.attendance === "present",
  );

  const veredito = podeVotarNaRodada({
    votanteId: votante.id,
    escolhidoId,
    votanteParticipou: votanteJogou,
    escolhidoParticipou: escolhidoJogou,
    rodadaFinalizada: rodada.status === "finished",
  });

  if (!veredito.permitido) {
    throw erroDeRegra("regra_violada", veredito.motivo ?? "Não foi possível registrar seu voto.");
  }

  const { error } = await clienteAdmin()
    .from("round_votes")
    .upsert(
      { round_id: rodadaId, voter_id: votante.id, target_id: escolhidoId, kind: tipo },
      { onConflict: "round_id,voter_id,kind" },
    );

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível registrar seu voto agora.");
  }
}

/** Apuração agregada. Nunca devolve quem votou. */
export async function apuracaoDaRodada(rodadaId: string, tipo: VoteKind): Promise<ApuracaoDaRodada> {
  const admin = clienteAdmin();

  const { data: contagemBruta } = await admin
    .from("v_round_vote_tally")
    .select("*")
    .eq("round_id", rodadaId)
    .eq("kind", tipo);

  const linhas = contagemBruta ?? [];
  if (linhas.length === 0) {
    return { tipo, contagem: [], vencedorId: null, empate: false, totalDeVotos: 0 };
  }

  const { data: perfis } = await admin
    .from("profiles")
    .select("id, full_name, nickname, photo_url")
    .in("id", linhas.map((l) => l.target_id));

  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));
  const apuracao = apurarVotos(linhas.map((l) => ({ alvoId: l.target_id, votos: l.votes })));

  return {
    tipo,
    contagem: linhas
      .map((linha) => {
        const perfil = porId.get(linha.target_id);
        return {
          profileId: linha.target_id,
          nome: perfil?.nickname?.trim() || perfil?.full_name || "Jogador",
          fotoUrl: perfil?.photo_url ?? null,
          votos: linha.votes,
        };
      })
      .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome)),
    vencedorId: apuracao.vencedorId,
    empate: apuracao.empate,
    totalDeVotos: apuracao.totalDeVotos,
  };
}

/** Em quem este jogador votou — só o próprio voto, nunca o dos outros. */
export async function meusVotosNaRodada(
  rodadaId: string,
  votanteId: string,
): Promise<Partial<Record<VoteKind, string>>> {
  const { data } = await clienteAdmin()
    .from("round_votes")
    .select("kind, target_id")
    .eq("round_id", rodadaId)
    .eq("voter_id", votanteId);

  const meus: Partial<Record<VoteKind, string>> = {};
  for (const voto of data ?? []) meus[voto.kind] = voto.target_id;
  return meus;
}
