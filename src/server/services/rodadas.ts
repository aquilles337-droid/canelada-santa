import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { faixaDe, type ParticipanteDoDominio, type RodadaDoDominio } from "@/domain/tipos";
import type {
  PrecosDaRodada,
  Profile,
  RegrasDeMulta,
  Round,
  RoundGuest,
  RoundParticipant,
  RoundStatus,
} from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";
import { garantirTemporadaAtual } from "./temporadas";

/**
 * Rodadas.
 *
 * Cada rodada e criada manualmente pelo administrador — o sistema nunca
 * inventa um racha semanal sozinho. Na criacao, os precos, as multas e os
 * prazos vigentes sao copiados para dentro da rodada: mudar as configuracoes
 * depois nao reescreve nada que ja aconteceu.
 */

export interface ParticipanteComPerfil extends RoundParticipant {
  perfil: Profile;
}

export interface ConvidadoComAnfitriao extends RoundGuest {
  anfitriao: Profile;
}

export interface RodadaCompleta {
  rodada: Round;
  participantes: ParticipanteComPerfil[];
  convidados: ConvidadoComAnfitriao[];
}

// ------------------------------------------------------------
// Conversao para a camada de regras
// ------------------------------------------------------------

export function rodadaParaDominio(rodada: Round): RodadaDoDominio {
  return {
    id: rodada.id,
    comecaEm: new Date(rodada.starts_at),
    listaFechaEm: new Date(rodada.list_closes_at),
    avulsosLiberadosEm: new Date(rodada.waitlist_unlock_at),
    capacidade: rodada.capacity,
    horasLimiteParaCancelar: rodada.cancel_deadline_hours,
    regrasDeMulta: rodada.fine_rules,
    situacao: rodada.status,
  };
}

export function participanteParaDominio(participante: RoundParticipant): ParticipanteDoDominio {
  return {
    id: participante.id,
    profileId: participante.profile_id,
    tipo: participante.kind,
    faixa: participante.priority_tier,
    situacao: participante.status,
    entrouEm: new Date(participante.joined_at),
    conviteExpiraEm: participante.invite_expires_at ? new Date(participante.invite_expires_at) : null,
  };
}

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

export async function carregarRodada(rodadaId: string): Promise<RodadaCompleta> {
  const admin = clienteAdmin();

  const { data: rodada } = await admin.from("rounds").select("*").eq("id", rodadaId).maybeSingle();
  if (!rodada) throw erroDeRegra("nao_encontrado", "Racha não encontrado.");

  const [{ data: participantes }, { data: convidados }] = await Promise.all([
    admin
      .from("round_participants")
      .select("*, perfil:profiles!round_participants_profile_id_fkey(*)")
      .eq("round_id", rodadaId)
      .order("priority_tier", { ascending: true })
      .order("joined_at", { ascending: true }),
    admin
      .from("round_guests")
      .select("*, anfitriao:profiles!round_guests_host_profile_id_fkey(*)")
      .eq("round_id", rodadaId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    rodada,
    participantes: (participantes ?? []) as unknown as ParticipanteComPerfil[],
    convidados: (convidados ?? []) as unknown as ConvidadoComAnfitriao[],
  };
}

/** A rodada que o jogador ve na tela inicial: a proxima que ainda vai acontecer. */
export async function proximaRodada(): Promise<Round | null> {
  const { data } = await clienteAdmin()
    .from("rounds")
    .select("*")
    .in("status", ["open", "closed", "in_progress"])
    .gte("starts_at", new Date(Date.now() - 6 * 3_600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function listarRodadas(
  opcoes: { situacoes?: RoundStatus[]; temporadaId?: string; limite?: number } = {},
): Promise<Round[]> {
  let consulta = clienteAdmin().from("rounds").select("*");

  if (opcoes.situacoes?.length) consulta = consulta.in("status", opcoes.situacoes);
  if (opcoes.temporadaId) consulta = consulta.eq("season_id", opcoes.temporadaId);

  const { data } = await consulta
    .order("starts_at", { ascending: false })
    .limit(opcoes.limite ?? 50);

  return data ?? [];
}

// ------------------------------------------------------------
// Criacao
// ------------------------------------------------------------

export interface NovaRodada {
  titulo?: string | null;
  /** Data e hora no fuso do grupo, ja convertidas para UTC pela camada de acao. */
  comecaEm: Date;
  local: string;
  endereco?: string | null;
  capacidade: number;
  quantidadeDeTimes: number;
  jogadoresPorTime?: number | null;
  minutosPorPartida: number;
  golsParaVencer: number;
  listaFechaEm: Date;
  regras?: string | null;
  /** Preco do avulso nesta rodada; sem valor, usa a configuracao atual. */
  precoAvulsoCentavos?: number | null;
  abrirImediatamente?: boolean;
}

export async function criarRodada(entrada: NovaRodada, atorId: string): Promise<Round> {
  const configuracoes = await lerConfiguracoes();
  const temporada = await garantirTemporadaAtual(entrada.comecaEm);

  if (entrada.capacidade < 2) {
    throw erroDeRegra("dados_invalidos", "A quantidade de vagas precisa ser pelo menos 2.");
  }
  if (entrada.quantidadeDeTimes < 2) {
    throw erroDeRegra("dados_invalidos", "O racha precisa de pelo menos 2 times.");
  }
  if (entrada.listaFechaEm > entrada.comecaEm) {
    throw erroDeRegra("dados_invalidos", "A lista precisa fechar antes do início do racha.");
  }
  if (entrada.comecaEm.getTime() <= Date.now()) {
    throw erroDeRegra("dados_invalidos", "A data do racha precisa ser no futuro.");
  }

  // Snapshot: o que valia hoje vale para esta rodada, para sempre.
  const precos: PrecosDaRodada = {
    casual_price_cents: entrada.precoAvulsoCentavos ?? configuracoes.casual_price_cents,
    guest_of_member_price_cents: configuracoes.guest_of_member_price_cents,
    guest_of_casual_price_cents: configuracoes.guest_of_casual_price_cents,
    allow_casual_guests: configuracoes.allow_casual_guests,
    guest_quota_per_member: configuracoes.guest_quota_per_member,
  };

  const multas: RegrasDeMulta = {
    late_cancel_fine_cents: configuracoes.late_cancel_fine_cents,
    no_show_multiplier: configuracoes.no_show_multiplier,
    cancel_deadline_hours: configuracoes.cancel_deadline_hours,
  };

  const liberacaoDeAvulsos = new Date(
    entrada.comecaEm.getTime() - configuracoes.waitlist_unlock_hours * 3_600_000,
  );

  const numero = await proximoNumeroDaRodada(temporada.id);

  const { data, error } = await clienteAdmin()
    .from("rounds")
    .insert({
      season_id: temporada.id,
      number: numero,
      title: entrada.titulo?.trim() || null,
      starts_at: entrada.comecaEm.toISOString(),
      venue: entrada.local.trim(),
      address: entrada.endereco?.trim() || null,
      capacity: entrada.capacidade,
      teams_count: entrada.quantidadeDeTimes,
      players_per_team: entrada.jogadoresPorTime ?? null,
      match_minutes: entrada.minutosPorPartida,
      goals_to_win: entrada.golsParaVencer,
      list_opens_at: new Date().toISOString(),
      list_closes_at: entrada.listaFechaEm.toISOString(),
      waitlist_unlock_at: liberacaoDeAvulsos.toISOString(),
      cancel_deadline_hours: configuracoes.cancel_deadline_hours,
      pricing: precos,
      fine_rules: multas,
      rules: entrada.regras?.trim() || null,
      status: entrada.abrirImediatamente === false ? "draft" : "open",
      created_by: atorId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível criar o racha agora.");
  }

  await registrarAuditoria({
    atorId,
    acao: "rodada.criada",
    entidade: "rounds",
    entidadeId: data.id,
    depois: {
      numero: data.number,
      comeca_em: data.starts_at,
      local: data.venue,
      vagas: data.capacity,
      precos,
      multas,
    },
  });

  if (data.status === "open") {
    await avisarAberturaDaRodada(data);
  }

  return data;
}

async function proximoNumeroDaRodada(temporadaId: string): Promise<number> {
  const { data } = await clienteAdmin()
    .from("rounds")
    .select("number")
    .eq("season_id", temporadaId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.number ?? 0) + 1;
}

export function nomeDaRodada(rodada: Round): string {
  return rodada.title?.trim() || `Canelada Santa #${rodada.number}`;
}

async function avisarAberturaDaRodada(rodada: Round): Promise<void> {
  const { data: jogadores } = await clienteAdmin()
    .from("profiles")
    .select("id")
    .eq("status", "active");

  await notificar({
    destinatarios: (jogadores ?? []).map((j) => j.id),
    tipo: "rodada.aberta",
    titulo: "⚽ Lista aberta!",
    corpo: `${nomeDaRodada(rodada)} está com a lista aberta. Garanta sua vaga.`,
    url: `/racha/${rodada.id}`,
    dados: { rodadaId: rodada.id },
  });
}

// ------------------------------------------------------------
// Ciclo de vida
// ------------------------------------------------------------

async function mudarSituacaoDaRodada(
  rodadaId: string,
  nova: RoundStatus,
  atorId: string,
  acao: Parameters<typeof registrarAuditoria>[0]["acao"],
  camposExtras: Partial<Round> = {},
): Promise<Round> {
  const { data, error } = await clienteAdmin()
    .from("rounds")
    .update({ status: nova, ...camposExtras })
    .eq("id", rodadaId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível atualizar o racha.");
  }

  await registrarAuditoria({
    atorId,
    acao,
    entidade: "rounds",
    entidadeId: rodadaId,
    depois: { situacao: nova },
  });

  return data;
}

export async function abrirRodada(rodadaId: string, atorId: string): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "open", atorId, "rodada.aberta");
  await avisarAberturaDaRodada(rodada);
  return rodada;
}

/**
 * Fecha a lista e acomoda os convidados.
 *
 * E aqui que o convidado entra: so depois de saber quantos jogadores do
 * grupo ficaram de fora e possivel dizer quantas vagas sobraram.
 */
export async function fecharLista(rodadaId: string, atorId: string): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "closed", atorId, "rodada.fechada", {
    closed_at: new Date().toISOString(),
  });

  const { consolidarConvidados } = await import("./convidados");
  await consolidarConvidados(rodadaId);

  const { data: dentro } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .eq("status", "confirmed");

  await notificar({
    destinatarios: (dentro ?? []).map((p) => p.profile_id),
    tipo: "lista.fechada",
    titulo: "Lista fechada",
    corpo: `${nomeDaRodada(rodada)}: a lista está fechada. Nos vemos na quadra!`,
    url: `/racha/${rodada.id}`,
  });

  return rodada;
}

export function iniciarRodada(rodadaId: string, atorId: string) {
  return mudarSituacaoDaRodada(rodadaId, "in_progress", atorId, "rodada.aberta");
}

export function finalizarRodada(rodadaId: string, atorId: string) {
  return mudarSituacaoDaRodada(rodadaId, "finished", atorId, "rodada.finalizada", {
    finished_at: new Date().toISOString(),
  });
}

export async function cancelarRodada(rodadaId: string, atorId: string): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "cancelled", atorId, "rodada.cancelada");

  const { data: participantes } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .in("status", ["confirmed", "waiting", "invited"]);

  await notificar({
    destinatarios: (participantes ?? []).map((p) => p.profile_id),
    tipo: "rodada.cancelada",
    titulo: "Racha cancelado",
    corpo: `${nomeDaRodada(rodada)} foi cancelado.`,
    url: `/racha/${rodada.id}`,
  });

  return rodada;
}

/** Faixa de prioridade a partir do vinculo atual do jogador. */
export function faixaDoPerfil(perfil: Profile): number {
  return faixaDe(perfil.is_member ? "monthly" : "casual");
}
