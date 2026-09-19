import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { chaveDeCobranca, competenciaDoMes, mensalidadeVencida, vencimentoDaMensalidade } from "@/domain/cobrancas";
import { formatarData, formatarDinheiro, mesAno } from "@/lib/format";
import type { Membership, Profile } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { baixarCobrancaManualmente, criarCobranca, reabrirCobranca } from "./cobrancas";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";

/**
 * Mensalidades.
 *
 * Uma linha por mensalista por mes de competencia, com a cobranca
 * correspondente. O valor sai das configuracoes no momento da geracao — se
 * o grupo mudar a mensalidade depois, os meses ja gerados nao mudam.
 *
 * Mensalista com mensalidade vencida fica inadimplente e nao entra em rodada
 * nova (a regra de bloqueio vive em src/domain/presenca.ts).
 */

export interface MensalidadeComJogador extends Membership {
  jogador: Profile;
}

/**
 * Gera as mensalidades do mes para todos os mensalistas ativos.
 *
 * Idempotente por construcao: a chave unica (jogador, competencia) impede a
 * segunda geracao, entao rodar a tarefa varias vezes no mesmo dia nao cobra
 * ninguem duas vezes.
 */
export async function gerarMensalidadesDoMes(
  referencia: Date = new Date(),
  atorId: string | null = null,
): Promise<{ geradas: number; competencia: string }> {
  const configuracoes = await lerConfiguracoes();
  const competencia = competenciaDoMes(referencia);
  const vencimento = vencimentoDaMensalidade(competencia, configuracoes.monthly_due_day);
  const admin = clienteAdmin();

  const { data: mensalistas } = await admin
    .from("profiles")
    .select("*")
    .eq("is_member", true)
    .eq("status", "active");

  if (!mensalistas || mensalistas.length === 0) return { geradas: 0, competencia };

  const { data: jaGeradas } = await admin
    .from("memberships")
    .select("profile_id")
    .eq("competence", competencia);

  const jaTem = new Set((jaGeradas ?? []).map((m) => m.profile_id));
  const pendentes = mensalistas.filter((m) => !jaTem.has(m.id));

  let geradas = 0;

  for (const jogador of pendentes) {
    const { data: mensalidade, error } = await admin
      .from("memberships")
      .insert({
        profile_id: jogador.id,
        competence: competencia,
        amount_cents: configuracoes.monthly_fee_cents,
        due_date: vencimento,
        status: "pending",
      })
      .select("*")
      .single();

    // Outra execucao simultanea pode ter criado a mesma linha: seguimos em frente.
    if (error || !mensalidade) continue;

    await criarCobranca({
      profileId: jogador.id,
      tipo: "monthly",
      valorCentavos: configuracoes.monthly_fee_cents,
      descricao: `Mensalidade de ${mesAno(`${competencia}T12:00:00.000Z`)}`,
      chave: chaveDeCobranca("monthly", { profileId: jogador.id, competencia }),
      mensalidadeId: mensalidade.id,
      vencimento,
      criadoPor: atorId,
    });

    await notificar({
      destinatarios: [jogador.id],
      tipo: "pagamento.pendente",
      titulo: "Mensalidade disponível",
      corpo: `${formatarDinheiro(configuracoes.monthly_fee_cents)} · vence em ${formatarData(vencimento)}.`,
      url: "/perfil/pagamentos",
    });

    geradas += 1;
  }

  if (geradas > 0) {
    await registrarAuditoria({
      atorId,
      acao: "mensalidade.gerada",
      entidade: "memberships",
      depois: { competencia, quantidade: geradas, valor: configuracoes.monthly_fee_cents },
    });
  }

  return { geradas, competencia };
}

/** Marca como vencidas as mensalidades que passaram do prazo. */
export async function marcarMensalidadesVencidas(hoje: Date = new Date()): Promise<number> {
  const admin = clienteAdmin();

  const { data: pendentes } = await admin
    .from("memberships")
    .select("id, due_date")
    .eq("status", "pending");

  const vencidas = (pendentes ?? []).filter((m) => mensalidadeVencida(m.due_date, hoje)).map((m) => m.id);
  if (vencidas.length === 0) return 0;

  await admin.from("memberships").update({ status: "overdue" }).in("id", vencidas);
  return vencidas.length;
}

export async function mensalidadesDoJogador(profileId: string, limite = 24): Promise<Membership[]> {
  const { data } = await clienteAdmin()
    .from("memberships")
    .select("*")
    .eq("profile_id", profileId)
    .order("competence", { ascending: false })
    .limit(limite);

  return data ?? [];
}

/** Situacao da mensalidade do mes corrente para cada mensalista. */
export async function panoramaDeMensalistas(referencia: Date = new Date()): Promise<{
  competencia: string;
  emDia: MensalidadeComJogador[];
  pendentes: MensalidadeComJogador[];
  inadimplentes: MensalidadeComJogador[];
  semMensalidade: Profile[];
}> {
  const competencia = competenciaDoMes(referencia);
  const admin = clienteAdmin();

  const [{ data: mensalidades }, { data: mensalistas }] = await Promise.all([
    admin
      .from("memberships")
      .select("*, jogador:profiles!memberships_profile_id_fkey(*)")
      .eq("competence", competencia),
    admin.from("profiles").select("*").eq("is_member", true).eq("status", "active"),
  ]);

  const linhas = (mensalidades ?? []) as unknown as MensalidadeComJogador[];
  const comMensalidade = new Set(linhas.map((m) => m.profile_id));

  return {
    competencia,
    emDia: linhas.filter((m) => m.status === "paid" || m.status === "waived"),
    pendentes: linhas.filter((m) => m.status === "pending"),
    inadimplentes: linhas.filter((m) => m.status === "overdue"),
    semMensalidade: (mensalistas ?? []).filter((j) => !comMensalidade.has(j.id)),
  };
}

/**
 * Marca a mensalidade como paga — a baixa manual de quem pagou em dinheiro.
 *
 * Quando existe cobranca ligada, quem baixa e ela: assim o pagamento aparece
 * no extrato do jogador e a notificacao sai, em vez de a mensalidade mudar
 * de situacao sozinha e a cobranca ficar pendurada em aberto.
 */
export async function marcarMensalidadePaga(mensalidadeId: string, atorId: string): Promise<void> {
  const admin = clienteAdmin();

  const { data: mensalidade } = await admin
    .from("memberships")
    .select("*")
    .eq("id", mensalidadeId)
    .maybeSingle();

  if (!mensalidade) throw erroDeRegra("nao_encontrado", "Mensalidade não encontrada.");
  if (mensalidade.status === "paid") return;

  const { data: cobranca } = await admin
    .from("charges")
    .select("id")
    .eq("membership_id", mensalidadeId)
    .in("status", ["pending", "expired"])
    .maybeSingle();

  if (cobranca) {
    await baixarCobrancaManualmente(cobranca.id, atorId, "mensalidade paga em dinheiro");
    return;
  }

  await admin
    .from("memberships")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", mensalidadeId);

  await registrarAuditoria({
    atorId,
    acao: "cobranca.baixada_manualmente",
    entidade: "memberships",
    entidadeId: mensalidadeId,
    depois: { situacao: "paid" },
  });
}

export interface DivergenciaDeValor {
  competencia: string;
  valorAtualCentavos: number;
  /** Mensalidades em aberto cujo valor ficou diferente do configurado. */
  desatualizadas: number;
}

/**
 * Mensalidades do mes que ficaram com valor diferente do configurado hoje.
 *
 * Acontece quando o grupo muda o valor depois de a competencia ja ter sido
 * gerada. Quem ja pagou nunca entra nesta conta: o valor daquele mes foi o
 * que foi.
 */
export async function divergenciaDeValor(
  referencia: Date = new Date(),
): Promise<DivergenciaDeValor> {
  const configuracoes = await lerConfiguracoes();
  const competencia = competenciaDoMes(referencia);

  const { data } = await clienteAdmin()
    .from("memberships")
    .select("id, amount_cents")
    .eq("competence", competencia)
    .in("status", ["pending", "overdue"]);

  return {
    competencia,
    valorAtualCentavos: configuracoes.monthly_fee_cents,
    desatualizadas: (data ?? []).filter((m) => m.amount_cents !== configuracoes.monthly_fee_cents)
      .length,
  };
}

/**
 * Passa o valor configurado hoje para as mensalidades do mes que ainda estao
 * em aberto.
 *
 * Mensalidade paga ou perdoada nao e tocada — o valor daquele mes ja foi
 * acertado, e mexer nisso bagunçaria o historico.
 *
 * O PIX em aberto daquela cobranca e cancelado junto: se ficasse valendo, o
 * jogador pagaria o valor velho num codigo gerado antes da mudanca, e a
 * cobranca seria quitada por um valor que nao e mais o dela.
 */
export async function atualizarValorDasMensalidades(
  atorId: string,
  referencia: Date = new Date(),
): Promise<{ atualizadas: number; valorCentavos: number }> {
  const configuracoes = await lerConfiguracoes();
  const competencia = competenciaDoMes(referencia);
  const valor = configuracoes.monthly_fee_cents;
  const admin = clienteAdmin();

  const { data: mensalidades } = await admin
    .from("memberships")
    .select("id, amount_cents")
    .eq("competence", competencia)
    .in("status", ["pending", "overdue"]);

  const paraAtualizar = (mensalidades ?? []).filter((m) => m.amount_cents !== valor);
  if (paraAtualizar.length === 0) return { atualizadas: 0, valorCentavos: valor };

  const ids = paraAtualizar.map((m) => m.id);
  await admin.from("memberships").update({ amount_cents: valor }).in("id", ids);

  const { data: cobrancas } = await admin
    .from("charges")
    .update({ amount_cents: valor })
    .in("membership_id", ids)
    .in("status", ["pending", "expired"])
    .select("id");

  const cobrancaIds = (cobrancas ?? []).map((c) => c.id);
  if (cobrancaIds.length > 0) {
    await admin
      .from("payments")
      .update({ status: "cancelled" })
      .in("charge_id", cobrancaIds)
      .eq("status", "pending");
  }

  await registrarAuditoria({
    atorId,
    acao: "cobranca.criada",
    entidade: "memberships",
    depois: {
      competencia,
      quantidade: paraAtualizar.length,
      valor_novo: valor,
      motivo: "valor da mensalidade atualizado pelo administrador",
    },
  });

  return { atualizadas: paraAtualizar.length, valorCentavos: valor };
}

/**
 * Volta a cobrar uma mensalidade perdoada ou cancelada.
 *
 * Se a cobranca dela sumiu por algum motivo, uma nova e criada com a mesma
 * chave de idempotencia — entao reabrir duas vezes nao cobra em dobro.
 */
export async function reabrirMensalidade(mensalidadeId: string, atorId: string): Promise<void> {
  const admin = clienteAdmin();

  const { data: mensalidade } = await admin
    .from("memberships")
    .select("*")
    .eq("id", mensalidadeId)
    .maybeSingle();

  if (!mensalidade) throw erroDeRegra("nao_encontrado", "Mensalidade não encontrada.");
  if (mensalidade.status === "paid") {
    throw erroDeRegra("regra_violada", "Esta mensalidade já foi paga.");
  }

  const { data: cobranca } = await admin
    .from("charges")
    .select("id")
    .eq("membership_id", mensalidadeId)
    .maybeSingle();

  if (cobranca) {
    await reabrirCobranca(cobranca.id, atorId);
    return;
  }

  // Sem cobranca ligada: cria uma, com o valor que valia naquele mes.
  await criarCobranca({
    profileId: mensalidade.profile_id,
    tipo: "monthly",
    valorCentavos: mensalidade.amount_cents,
    descricao: `Mensalidade de ${mesAno(`${mensalidade.competence}T12:00:00.000Z`)}`,
    chave: chaveDeCobranca("monthly", {
      profileId: mensalidade.profile_id,
      competencia: mensalidade.competence,
    }),
    mensalidadeId,
    vencimento: mensalidade.due_date,
    criadoPor: atorId,
  });

  await admin
    .from("memberships")
    .update({ status: "pending", paid_at: null })
    .eq("id", mensalidadeId);

  await registrarAuditoria({
    atorId,
    acao: "cobranca.criada",
    entidade: "memberships",
    entidadeId: mensalidadeId,
    depois: { situacao: "pending", motivo: "cobrada novamente pelo administrador" },
  });
}

/** Perdoa a mensalidade de um jogador num mes (ex.: quem estava machucado). */
export async function perdoarMensalidade(
  mensalidadeId: string,
  atorId: string,
  motivo: string,
): Promise<void> {
  const admin = clienteAdmin();

  const { data: mensalidade } = await admin
    .from("memberships")
    .select("*")
    .eq("id", mensalidadeId)
    .maybeSingle();

  if (!mensalidade) throw erroDeRegra("nao_encontrado", "Mensalidade não encontrada.");

  await admin.from("memberships").update({ status: "waived" }).eq("id", mensalidadeId);
  await admin
    .from("charges")
    .update({ status: "waived" })
    .eq("membership_id", mensalidadeId)
    .in("status", ["pending", "expired"]);

  await registrarAuditoria({
    atorId,
    acao: "cobranca.perdoada",
    entidade: "memberships",
    entidadeId: mensalidadeId,
    depois: { motivo },
  });
}
