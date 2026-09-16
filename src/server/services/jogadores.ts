import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { MemberStatus, PlayerPosition, Profile, UserRole } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";

/**
 * Jogadores e permissoes.
 *
 * Administrador tambem e jogador: mudar o papel de alguem nao muda nada na
 * vida dele como atleta — ele continua confirmando presenca, pagando e
 * aparecendo no ranking.
 */

export async function buscarPerfil(profileId: string): Promise<Profile | null> {
  const { data } = await clienteAdmin().from("profiles").select("*").eq("id", profileId).maybeSingle();
  return data;
}

export interface FiltroDeJogadores {
  apenasAtivos?: boolean;
  apenasMensalistas?: boolean;
  busca?: string;
}

export async function listarJogadores(filtro: FiltroDeJogadores = {}): Promise<Profile[]> {
  let consulta = clienteAdmin().from("profiles").select("*");

  if (filtro.apenasAtivos) consulta = consulta.eq("status", "active");
  if (filtro.apenasMensalistas) consulta = consulta.eq("is_member", true);
  if (filtro.busca?.trim()) {
    const termo = `%${filtro.busca.trim()}%`;
    consulta = consulta.or(`full_name.ilike.${termo},nickname.ilike.${termo},phone.ilike.${termo}`);
  }

  const { data } = await consulta.order("full_name", { ascending: true });
  return data ?? [];
}

/** Campos que o proprio jogador pode mudar. Papel, situacao e mensalista ficam de fora. */
export interface EdicaoDePerfil {
  nome?: string;
  apelido?: string | null;
  posicao?: PlayerPosition;
  ehGoleiro?: boolean;
  pesoKg?: number | null;
  alturaCm?: number | null;
  fotoUrl?: string | null;
  notificacoesAtivas?: boolean;
}

export async function atualizarPerfil(profileId: string, edicao: EdicaoDePerfil): Promise<Profile> {
  const alteracoes: Partial<Profile> = {};

  if (edicao.nome !== undefined) {
    const nome = edicao.nome.trim().replace(/\s+/g, " ");
    if (nome.length < 2 || nome.length > 80) {
      throw erroDeRegra("dados_invalidos", "Informe seu nome completo.");
    }
    alteracoes.full_name = nome;
  }

  if (edicao.apelido !== undefined) {
    const apelido = edicao.apelido?.trim() ?? "";
    alteracoes.nickname = apelido.length ? apelido.slice(0, 30) : null;
  }

  if (edicao.posicao !== undefined) alteracoes.position = edicao.posicao;
  if (edicao.fotoUrl !== undefined) alteracoes.photo_url = edicao.fotoUrl;
  if (edicao.notificacoesAtivas !== undefined) alteracoes.notifications_enabled = edicao.notificacoesAtivas;

  // Quem joga de goleiro fixo e sempre goleiro para o algoritmo de times.
  if (edicao.ehGoleiro !== undefined || edicao.posicao !== undefined) {
    alteracoes.is_goalkeeper = edicao.posicao === "goleiro" ? true : (edicao.ehGoleiro ?? false);
  }

  if (edicao.pesoKg !== undefined) {
    if (edicao.pesoKg !== null && (edicao.pesoKg < 30 || edicao.pesoKg > 250)) {
      throw erroDeRegra("dados_invalidos", "Peso fora do esperado.");
    }
    alteracoes.weight_kg = edicao.pesoKg;
  }

  if (edicao.alturaCm !== undefined) {
    if (edicao.alturaCm !== null && (edicao.alturaCm < 100 || edicao.alturaCm > 250)) {
      throw erroDeRegra("dados_invalidos", "Altura fora do esperado.");
    }
    alteracoes.height_cm = edicao.alturaCm;
  }

  const { data, error } = await clienteAdmin()
    .from("profiles")
    .update(alteracoes)
    .eq("id", profileId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível salvar seu perfil agora.");
  }

  return data;
}

async function mudarSituacao(
  alvoId: string,
  atorId: string,
  novoStatus: MemberStatus,
  acao: Parameters<typeof registrarAuditoria>[0]["acao"],
  motivo?: string | null,
): Promise<Profile> {
  const antes = await buscarPerfil(alvoId);
  if (!antes) throw erroDeRegra("nao_encontrado", "Jogador não encontrado.");

  const banindo = novoStatus === "banned";
  const { data, error } = await clienteAdmin()
    .from("profiles")
    .update({
      status: novoStatus,
      banned_at: banindo ? new Date().toISOString() : null,
      banned_reason: banindo ? (motivo ?? null) : null,
    })
    .eq("id", alvoId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível alterar a situação do jogador.");
  }

  await registrarAuditoria({
    atorId,
    acao,
    entidade: "profiles",
    entidadeId: alvoId,
    antes: { status: antes.status },
    depois: { status: novoStatus, motivo: motivo ?? null },
  });

  return data;
}

/**
 * Banir preserva todo o historico: estatisticas, gols e presencas passadas
 * continuam no sistema. O banimento so impede participar de novas rodadas.
 */
export function banirJogador(alvoId: string, atorId: string, motivo?: string | null) {
  if (alvoId === atorId) {
    throw erroDeRegra("regra_violada", "Você não pode banir a si mesmo.");
  }
  return mudarSituacao(alvoId, atorId, "banned", "jogador.banido", motivo);
}

export function desbanirJogador(alvoId: string, atorId: string) {
  return mudarSituacao(alvoId, atorId, "active", "jogador.desbanido");
}

export function suspenderJogador(alvoId: string, atorId: string, motivo?: string | null) {
  if (alvoId === atorId) {
    throw erroDeRegra("regra_violada", "Você não pode suspender a si mesmo.");
  }
  return mudarSituacao(alvoId, atorId, "suspended", "jogador.suspenso", motivo);
}

export function reativarJogador(alvoId: string, atorId: string) {
  return mudarSituacao(alvoId, atorId, "active", "jogador.reativado");
}

export async function definirPapel(alvoId: string, atorId: string, papel: UserRole): Promise<Profile> {
  const antes = await buscarPerfil(alvoId);
  if (!antes) throw erroDeRegra("nao_encontrado", "Jogador não encontrado.");

  // O grupo nao pode ficar sem nenhum administrador.
  if (antes.role === "admin" && papel === "player") {
    const { count } = await clienteAdmin()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw erroDeRegra("regra_violada", "O grupo precisa de pelo menos um administrador.");
    }
  }

  const { data, error } = await clienteAdmin()
    .from("profiles")
    .update({ role: papel })
    .eq("id", alvoId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível alterar a permissão.");
  }

  await registrarAuditoria({
    atorId,
    acao: "jogador.papel_alterado",
    entidade: "profiles",
    entidadeId: alvoId,
    antes: { papel: antes.role },
    depois: { papel },
  });

  return data;
}

/** Liga ou desliga o mensalista. A cobranca do mes e tratada em src/server/services/mensalidades.ts. */
export async function definirMensalista(
  alvoId: string,
  atorId: string,
  ehMensalista: boolean,
): Promise<Profile> {
  const antes = await buscarPerfil(alvoId);
  if (!antes) throw erroDeRegra("nao_encontrado", "Jogador não encontrado.");

  const { data, error } = await clienteAdmin()
    .from("profiles")
    .update({
      is_member: ehMensalista,
      member_since: ehMensalista ? (antes.member_since ?? new Date().toISOString().slice(0, 10)) : null,
    })
    .eq("id", alvoId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível alterar o mensalista.");
  }

  await registrarAuditoria({
    atorId,
    acao: "jogador.mensalista_alterado",
    entidade: "profiles",
    entidadeId: alvoId,
    antes: { mensalista: antes.is_member },
    depois: { mensalista: ehMensalista },
  });

  return data;
}
