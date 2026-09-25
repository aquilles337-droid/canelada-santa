import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import {
  quemFicaEQuemSai,
  resultadoDoPlacar,
  type PlacarDaPartida,
  type RegistroDoSorteio,
} from "@/domain/partida";
import { escalarGoleiros, type GoleirosDaPartida } from "@/domain/goleiros";
import type { Match, MatchEvent, Team } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { carregarRodada } from "./rodadas";
import { goleirosDaRodada, timesDaRodada, type GoleiroDaRodada, type TimeComIntegrantes } from "./times";

/**
 * Modo jogo.
 *
 * A fila de espera das equipes não vira tabela: ela é deduzida das partidas
 * já disputadas — quem jogou há mais tempo espera menos. Assim não existe
 * um segundo lugar para o estado ficar desencontrado.
 *
 * Registrar gol e assistência é opcional (§33). Se o grupo não registrar,
 * o sistema não inventa estatística nenhuma.
 */

export interface EstadoDoJogo {
  times: TimeComIntegrantes[];
  /** Os goleiros da rodada. Não pertencem a time: são do gol. */
  goleiros: GoleiroDaRodada[];
  partidaAtual: Match | null;
  partidas: Match[];
  eventos: MatchEvent[];
  /** Equipes esperando, na ordem em que entram. */
  fila: Team[];
  duracaoEmMinutos: number;
  golsParaVencer: number;
}

/** Fila de espera: quem jogou há mais tempo entra primeiro. */
function montarFila(times: Team[], partidas: Match[], partidaAtual: Match | null): Team[] {
  const ultimaPartida = new Map<string, number>();

  for (const partida of partidas) {
    ultimaPartida.set(partida.team_a_id, Math.max(ultimaPartida.get(partida.team_a_id) ?? 0, partida.seq));
    ultimaPartida.set(partida.team_b_id, Math.max(ultimaPartida.get(partida.team_b_id) ?? 0, partida.seq));
  }

  const jogando = new Set(
    partidaAtual ? [partidaAtual.team_a_id, partidaAtual.team_b_id] : [],
  );

  return times
    .filter((time) => !jogando.has(time.id))
    .sort((a, b) => {
      const jogouA = ultimaPartida.get(a.id) ?? 0;
      const jogouB = ultimaPartida.get(b.id) ?? 0;
      if (jogouA !== jogouB) return jogouA - jogouB;
      return a.idx - b.idx;
    });
}

export async function estadoDoJogo(rodadaId: string): Promise<EstadoDoJogo> {
  const admin = clienteAdmin();
  const [{ rodada }, times, goleiros] = await Promise.all([
    carregarRodada(rodadaId),
    timesDaRodada(rodadaId),
    goleirosDaRodada(rodadaId),
  ]);

  const { data: partidas } = await admin
    .from("matches")
    .select("*")
    .eq("round_id", rodadaId)
    .order("seq", { ascending: true });

  const todas = partidas ?? [];
  const partidaAtual = todas.find((p) => p.status === "live" || p.status === "scheduled") ?? null;

  const { data: eventos } = await admin
    .from("match_events")
    .select("*")
    .in("match_id", todas.map((p) => p.id).length > 0 ? todas.map((p) => p.id) : ["sem-partidas"])
    .order("created_at", { ascending: true });

  return {
    times,
    goleiros,
    partidaAtual,
    partidas: todas,
    eventos: eventos ?? [],
    fila: montarFila(times, todas, partidaAtual),
    duracaoEmMinutos: rodada.match_minutes,
    golsParaVencer: rodada.goals_to_win,
  };
}

/** Cria a primeira partida: Time 1 contra Time 2, o resto na fila. */
export async function abrirPrimeiraPartida(rodadaId: string, atorId: string): Promise<Match> {
  const times = await timesDaRodada(rodadaId);

  if (times.length < 2) {
    throw erroDeRegra("regra_violada", "Gere os times antes de começar o jogo.");
  }

  const { data: jaExiste } = await clienteAdmin()
    .from("matches")
    .select("*")
    .eq("round_id", rodadaId)
    .order("seq", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jaExiste) return jaExiste;

  return criarPartida(rodadaId, 1, times[0]!.id, times[1]!.id, atorId);
}

/**
 * Quem vai a cada gol na próxima partida.
 *
 * O goleiro é do GOL: a linha gira na frente dele. Com dois goleiros nada
 * muda a noite toda; com três ou mais eles se revezam, e quem já estava num
 * gol e continua escalado não atravessa o campo.
 *
 * Fica gravado na partida porque é assim que a vitória do goleiro é contada
 * depois: pelo lado que ele defendeu, não pelo time a que pertenceria.
 */
async function escalarOsGols(rodadaId: string): Promise<GoleirosDaPartida> {
  const admin = clienteAdmin();

  const [goleiros, { data: partidas }] = await Promise.all([
    goleirosDaRodada(rodadaId),
    admin
      .from("matches")
      .select("goalkeeper_a_id, goalkeeper_b_id")
      .eq("round_id", rodadaId)
      .order("seq", { ascending: true }),
  ]);

  const anteriores: GoleirosDaPartida[] = (partidas ?? []).map((p) => ({
    ladoA: p.goalkeeper_a_id,
    ladoB: p.goalkeeper_b_id,
  }));

  const escalacao = escalarGoleiros(
    goleiros.map((g) => g.participacaoId),
    anteriores,
  );

  return { ladoA: escalacao.ladoA, ladoB: escalacao.ladoB };
}

async function criarPartida(
  rodadaId: string,
  seq: number,
  timeA: string,
  timeB: string,
  atorId: string,
): Promise<Match> {
  const gols = await escalarOsGols(rodadaId);

  const { data, error } = await clienteAdmin()
    .from("matches")
    .insert({
      round_id: rodadaId,
      seq,
      team_a_id: timeA,
      team_b_id: timeB,
      goalkeeper_a_id: gols.ladoA,
      goalkeeper_b_id: gols.ladoB,
      status: "scheduled",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível abrir a partida.");
  }

  await registrarAuditoria({
    atorId,
    acao: "partida.iniciada",
    entidade: "matches",
    entidadeId: data.id,
    depois: { rodada: rodadaId, seq },
  });

  return data;
}

/** Aperta o play: o cronômetro começa a contar. */
export async function iniciarCronometro(partidaId: string): Promise<Match> {
  const { data, error } = await clienteAdmin()
    .from("matches")
    .update({ status: "live", started_at: new Date().toISOString() })
    .eq("id", partidaId)
    .eq("status", "scheduled")
    .select("*")
    .single();

  if (error || !data) {
    // Já estava rolando: devolvemos a partida como está.
    const { data: atual } = await clienteAdmin()
      .from("matches")
      .select("*")
      .eq("id", partidaId)
      .maybeSingle();

    if (atual) return atual;
    throw erroDeRegra("nao_encontrado", "Partida não encontrada.");
  }

  return data;
}

export interface GolRegistrado {
  partidaId: string;
  timeId: string;
  participacaoId?: string | null;
  convidadoId?: string | null;
  assistenciaDe?: { participacaoId?: string | null; convidadoId?: string | null } | null;
  contraProprioTime?: boolean;
}

/**
 * Registra um gol (e, se informada, a assistência).
 *
 * O autor é opcional: dá para marcar "gol do time" sem escolher jogador,
 * que é como o racha funciona na prática quando ninguém lembra quem fez.
 */
export async function registrarGol(gol: GolRegistrado, atorId: string): Promise<void> {
  const admin = clienteAdmin();

  const { data: partida } = await admin.from("matches").select("*").eq("id", gol.partidaId).maybeSingle();
  if (!partida) throw erroDeRegra("nao_encontrado", "Partida não encontrada.");
  if (partida.status === "finished") {
    throw erroDeRegra("regra_violada", "Esta partida já terminou.");
  }

  const { data: evento, error } = await admin
    .from("match_events")
    .insert({
      match_id: gol.partidaId,
      kind: gol.contraProprioTime ? "own_goal" : "goal",
      team_id: gol.timeId,
      participant_id: gol.participacaoId ?? null,
      guest_id: gol.convidadoId ?? null,
      created_by: atorId,
    })
    .select("*")
    .single();

  if (error || !evento) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível registrar o gol.");
  }

  if (gol.assistenciaDe && (gol.assistenciaDe.participacaoId || gol.assistenciaDe.convidadoId)) {
    await admin.from("match_events").insert({
      match_id: gol.partidaId,
      kind: "assist",
      team_id: gol.timeId,
      participant_id: gol.assistenciaDe.participacaoId ?? null,
      guest_id: gol.assistenciaDe.convidadoId ?? null,
      related_event_id: evento.id,
      created_by: atorId,
    });
  }

  // Gol contra conta para o adversário no placar.
  const timeQuePontuou = gol.contraProprioTime
    ? gol.timeId === partida.team_a_id
      ? partida.team_b_id
      : partida.team_a_id
    : gol.timeId;

  const paraOTimeA = timeQuePontuou === partida.team_a_id;

  await admin
    .from("matches")
    .update({
      score_a: paraOTimeA ? partida.score_a + 1 : partida.score_a,
      score_b: paraOTimeA ? partida.score_b : partida.score_b + 1,
      // O primeiro gol também dá o start, para o placar nunca ficar travado
      // caso alguém esqueça de apertar o play.
      status: partida.status === "scheduled" ? "live" : partida.status,
      started_at: partida.started_at ?? new Date().toISOString(),
    })
    .eq("id", gol.partidaId);
}

/** Desfaz um gol registrado por engano. */
export async function desfazerGol(eventoId: string): Promise<void> {
  const admin = clienteAdmin();

  const { data: evento } = await admin.from("match_events").select("*").eq("id", eventoId).maybeSingle();
  if (!evento || (evento.kind !== "goal" && evento.kind !== "own_goal")) return;

  const { data: partida } = await admin.from("matches").select("*").eq("id", evento.match_id).maybeSingle();
  if (!partida) return;

  const timeQuePontuou =
    evento.kind === "own_goal"
      ? evento.team_id === partida.team_a_id
        ? partida.team_b_id
        : partida.team_a_id
      : evento.team_id;

  const eraDoTimeA = timeQuePontuou === partida.team_a_id;

  // A assistência ligada ao gol cai junto (cascata na chave estrangeira).
  await admin.from("match_events").delete().eq("id", eventoId);
  await admin
    .from("matches")
    .update({
      score_a: eraDoTimeA ? Math.max(0, partida.score_a - 1) : partida.score_a,
      score_b: eraDoTimeA ? partida.score_b : Math.max(0, partida.score_b - 1),
    })
    .eq("id", evento.match_id);
}

export interface FimDaPartida {
  partida: Match;
  proxima: Match | null;
  explicacao: string;
  sorteio: RegistroDoSorteio | null;
}

/**
 * Encerra a partida e já monta a próxima seguindo a regra do quem ganha fica.
 */
export async function encerrarPartida(partidaId: string, atorId: string): Promise<FimDaPartida> {
  const admin = clienteAdmin();

  const { data: partida } = await admin.from("matches").select("*").eq("id", partidaId).maybeSingle();
  if (!partida) throw erroDeRegra("nao_encontrado", "Partida não encontrada.");
  if (partida.status === "finished") {
    throw erroDeRegra("conflito", "Esta partida já foi encerrada.");
  }

  const placar: PlacarDaPartida = {
    timeA: partida.team_a_id,
    timeB: partida.team_b_id,
    golsA: partida.score_a,
    golsB: partida.score_b,
  };

  const resultado = resultadoDoPlacar(placar);
  const estado = await estadoDoJogo(partida.round_id);
  const fila = montarFila(estado.times, estado.partidas, partida).map((time) => time.id);

  // A semente sai da própria partida: o sorteio fica reproduzível e auditável.
  const semente = Number.parseInt(partida.id.replace(/\D/g, "").slice(0, 9) || "1", 10) + partida.seq;
  const proxima = quemFicaEQuemSai(placar, fila, { semente });

  const duracao = partida.started_at
    ? Math.round((Date.now() - new Date(partida.started_at).getTime()) / 1000)
    : null;

  const { data: encerrada } = await admin
    .from("matches")
    .update({
      status: "finished",
      result: resultado,
      ended_at: new Date().toISOString(),
      duration_seconds: duracao,
      tiebreak: proxima.sorteio
        ? {
            motivo: proxima.sorteio.motivo,
            times_sorteados: proxima.sorteio.timesSorteados,
            time_que_saiu: proxima.sorteio.timeQueSaiu,
            semente: proxima.sorteio.semente,
            decidido_em: proxima.sorteio.decididoEm,
          }
        : null,
    })
    .eq("id", partidaId)
    .select("*")
    .single();

  await registrarAuditoria({
    atorId,
    acao: proxima.sorteio ? "partida.empate_sorteado" : "partida.encerrada",
    entidade: "matches",
    entidadeId: partidaId,
    depois: {
      placar: `${partida.score_a} x ${partida.score_b}`,
      resultado,
      sorteio: proxima.sorteio,
      explicacao: proxima.explicacao,
    },
  });

  let partidaSeguinte: Match | null = null;
  if (estado.times.length >= 2) {
    partidaSeguinte = await criarPartida(
      partida.round_id,
      partida.seq + 1,
      proxima.timeA,
      proxima.timeB,
      atorId,
    );
  }

  return {
    partida: encerrada ?? partida,
    proxima: partidaSeguinte,
    explicacao: proxima.explicacao,
    sorteio: proxima.sorteio,
  };
}

/** Ajuste manual do placar, para quando alguém errou o registro. */
export async function ajustarPlacar(
  partidaId: string,
  golsA: number,
  golsB: number,
): Promise<void> {
  if (golsA < 0 || golsB < 0) {
    throw erroDeRegra("dados_invalidos", "O placar não pode ser negativo.");
  }

  const { error } = await clienteAdmin()
    .from("matches")
    .update({ score_a: golsA, score_b: golsB })
    .eq("id", partidaId)
    .neq("status", "finished");

  if (error) throw erroDeRegra("servico_indisponivel", "Não foi possível ajustar o placar.");
}
