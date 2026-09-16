import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { chaveDeCobranca, competenciaDoMes, mensalidadeVencida, vencimentoDaMensalidade } from "@/domain/cobrancas";
import { formatarData, formatarDinheiro, mesAno } from "@/lib/format";
import type { Membership, Profile } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { criarCobranca } from "./cobrancas";
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
