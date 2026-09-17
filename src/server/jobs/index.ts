import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { competenciaDoMes } from "@/domain/cobrancas";
import { formatarHora } from "@/lib/format";
import type { Json } from "@/lib/supabase/tipos";
import { expirarConvitesDeVaga, promoverFilaDaRodada } from "@/server/services/presenca";
import { fecharLista, nomeDaRodada } from "@/server/services/rodadas";
import { gerarMensalidadesDoMes, marcarMensalidadesVencidas } from "@/server/services/mensalidades";
import { garantirTemporadaAtual } from "@/server/services/temporadas";
import { notificar } from "@/server/services/notificacoes";
import { lerConfiguracoes } from "@/server/services/configuracoes";

/**
 * Tarefas agendadas.
 *
 * Rodam a partir do cron do servidor (ver README), nunca do navegador de
 * ninguém: o racha não pode depender de alguém estar com o aplicativo aberto
 * para a fila andar.
 *
 * Todo job é IDEMPOTENTE. Rodar a cada minuto, rodar duas vezes no mesmo
 * minuto ou rodar depois de uma queda do servidor tem que dar no mesmo
 * resultado — por isso cada um filtra pelo estado atual em vez de assumir o
 * que já aconteceu.
 */

export interface ResultadoDeJob {
  job: string;
  ok: boolean;
  detalhes: Record<string, unknown>;
  erro?: string;
}

type Job = () => Promise<Record<string, unknown>>;

/** Fecha as listas cujo horário de fechamento já passou. */
const fecharListasVencidas: Job = async () => {
  const { data: rodadas } = await clienteAdmin()
    .from("rounds")
    .select("id")
    .eq("status", "open")
    .lte("list_closes_at", new Date().toISOString());

  for (const rodada of rodadas ?? []) {
    // Ator nulo: quem fechou foi o relógio, não uma pessoa.
    await fecharLista(rodada.id, null);
  }

  return { listasFechadas: rodadas?.length ?? 0 };
};

/**
 * Chama a fila das rodadas abertas.
 *
 * É aqui que a janela das 5 horas acontece sozinha: passado o horário, a
 * própria promoção passa a aceitar avulsos, sem ninguém precisar apertar
 * nada.
 */
const promoverFilas: Job = async () => {
  const { data: rodadas } = await clienteAdmin()
    .from("rounds")
    .select("id")
    .in("status", ["open", "closed"])
    .gte("starts_at", new Date().toISOString());

  let chamados = 0;
  for (const rodada of rodadas ?? []) {
    chamados += await promoverFilaDaRodada(rodada.id);
  }

  return { rodadas: rodadas?.length ?? 0, chamados };
};

/** Recolhe as vagas de quem não respondeu no prazo e chama os próximos. */
const recolherVagasVencidas: Job = async () => {
  const devolvidas = await expirarConvitesDeVaga();
  return { vagasDevolvidas: devolvidas };
};

/** Gera as mensalidades do mês no dia configurado. */
const gerarMensalidades: Job = async () => {
  const configuracoes = await lerConfiguracoes();
  const hoje = new Date();
  const diaDeHoje = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", day: "2-digit" }).format(hoje),
  );

  if (diaDeHoje !== configuracoes.monthly_generation_day) {
    return { gerou: false, motivo: "fora do dia de geração" };
  }

  const resultado = await gerarMensalidadesDoMes(hoje, null);
  return { gerou: true, competencia: resultado.competencia, geradas: resultado.geradas };
};

/** Marca como vencidas as mensalidades que passaram do prazo. */
const marcarVencidos: Job = async () => {
  const vencidas = await marcarMensalidadesVencidas();
  return { mensalidadesVencidas: vencidas };
};

/**
 * Lembra quem confirmou que o racha é hoje.
 *
 * O aviso sai uma vez só: a coluna `notifications` é consultada antes, então
 * rodar o job de minuto em minuto não enche o celular de ninguém.
 */
const lembrarDoRacha: Job = async () => {
  const agora = new Date();
  const daquiTresHoras = new Date(agora.getTime() + 3 * 3_600_000);

  const { data: rodadas } = await clienteAdmin()
    .from("rounds")
    .select("*")
    .in("status", ["open", "closed"])
    .gte("starts_at", agora.toISOString())
    .lte("starts_at", daquiTresHoras.toISOString());

  let avisados = 0;

  for (const rodada of rodadas ?? []) {
    const { data: confirmados } = await clienteAdmin()
      .from("round_participants")
      .select("profile_id")
      .eq("round_id", rodada.id)
      .eq("status", "confirmed");

    const destinatarios = (confirmados ?? []).map((p) => p.profile_id);
    if (destinatarios.length === 0) continue;

    const { data: jaAvisados } = await clienteAdmin()
      .from("notifications")
      .select("profile_id")
      .eq("type", "rodada.lembrete")
      .in("profile_id", destinatarios)
      .gte("created_at", new Date(agora.getTime() - 12 * 3_600_000).toISOString());

    const jaReceberam = new Set((jaAvisados ?? []).map((n) => n.profile_id));
    const faltando = destinatarios.filter((id) => !jaReceberam.has(id));
    if (faltando.length === 0) continue;

    await notificar({
      destinatarios: faltando,
      tipo: "rodada.lembrete",
      titulo: "Hoje tem racha! ⚽",
      corpo: `${nomeDaRodada(rodada)} às ${formatarHora(rodada.starts_at)} — ${rodada.venue}.`,
      url: `/racha/${rodada.id}`,
    });

    avisados += faltando.length;
  }

  return { avisados };
};

/** Mantém a temporada corrente criada depois da virada. */
const virarTemporada: Job = async () => {
  const temporada = await garantirTemporadaAtual();
  return { temporada: temporada.name, competencia: competenciaDoMes(new Date()) };
};

const JOBS: Record<string, Job> = {
  "fechar-listas": fecharListasVencidas,
  "promover-filas": promoverFilas,
  "recolher-vagas": recolherVagasVencidas,
  "gerar-mensalidades": gerarMensalidades,
  "marcar-vencidos": marcarVencidos,
  "lembrar-do-racha": lembrarDoRacha,
  "virar-temporada": virarTemporada,
};

export const NOMES_DOS_JOBS = Object.keys(JOBS);

/**
 * Roda um job registrando início, fim e resultado em `job_runs`.
 *
 * Uma falha isolada nunca derruba os outros: cada job é independente, e o
 * erro fica gravado para o administrador conseguir ver o que aconteceu.
 */
async function executar(nome: string, job: Job): Promise<ResultadoDeJob> {
  const admin = clienteAdmin();

  const { data: execucao } = await admin
    .from("job_runs")
    .insert({ job: nome, status: "running" })
    .select("id")
    .single();

  try {
    const detalhes = await job();

    if (execucao) {
      await admin
        .from("job_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          result: detalhes as Json,
        })
        .eq("id", execucao.id);
    }

    return { job: nome, ok: true, detalhes };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[canelada] job ${nome} falhou`, erro);

    if (execucao) {
      await admin
        .from("job_runs")
        .update({ status: "error", finished_at: new Date().toISOString(), error: mensagem })
        .eq("id", execucao.id);
    }

    return { job: nome, ok: false, detalhes: {}, erro: mensagem };
  }
}

/** Roda todos os jogos da vez (ou apenas os informados). */
export async function rodarTarefasAgendadas(apenas?: string[]): Promise<ResultadoDeJob[]> {
  const selecionados = apenas?.length
    ? apenas.filter((nome) => nome in JOBS)
    : NOMES_DOS_JOBS;

  const resultados: ResultadoDeJob[] = [];
  for (const nome of selecionados) {
    resultados.push(await executar(nome, JOBS[nome]!));
  }

  return resultados;
}
