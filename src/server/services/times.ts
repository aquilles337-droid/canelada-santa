import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import {
  gerarTimesEquilibrados,
  montarHistoricoDeDuplas,
  type DestinoDoGoleiroExtra,
  type JogadorParaSorteio,
  type ResultadoDoSorteio,
} from "@/domain/times";
import { sementeDeTexto } from "@/lib/utils";
import type { Team, TeamMember } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { notasConsolidadas } from "./avaliacoes";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";
import { carregarRodada, nomeDaRodada } from "./rodadas";

/**
 * Geração e gravação dos times.
 *
 * O sorteio em si é uma função pura em src/domain/times.ts. Aqui só
 * acontece o trabalho de ir buscar as notas, montar o histórico de duplas,
 * gravar o resultado e avisar o grupo.
 */

/** Cores dos times, na ordem. A primeira é o dourado da casa. */
export const CORES_DOS_TIMES = [
  { nome: "Time Ouro", cor: "ouro", emoji: "🟡" },
  { nome: "Time Azul", cor: "azul", emoji: "🔵" },
  { nome: "Time Vermelho", cor: "vermelho", emoji: "🔴" },
  { nome: "Time Branco", cor: "branco", emoji: "⚪" },
  { nome: "Time Verde", cor: "verde", emoji: "🟢" },
  { nome: "Time Roxo", cor: "roxo", emoji: "🟣" },
] as const;

export interface TimeComIntegrantes extends Team {
  integrantes: (TeamMember & { nome: string; ehGoleiro: boolean; ehConvidado: boolean })[];
}

/**
 * Duplas que já jogaram juntas nas últimas rodadas, para o sorteio evitar
 * repetir exatamente os mesmos grupos.
 */
async function historicoDeDuplas(rodadaAtualId: string, janela: number) {
  const { data: rodadas } = await clienteAdmin()
    .from("rounds")
    .select("id")
    .in("status", ["finished", "in_progress"])
    .neq("id", rodadaAtualId)
    .order("starts_at", { ascending: false })
    .limit(janela);

  const ids = (rodadas ?? []).map((r) => r.id);
  if (ids.length === 0) return new Map<string, number>();

  const { data: times } = await clienteAdmin()
    .from("teams")
    .select("id, round_id, team_members(participant_id, guest_id)")
    .in("round_id", ids);

  const porRodada = new Map<string, string[][]>();

  for (const time of (times ?? []) as unknown as {
    id: string;
    round_id: string;
    team_members: { participant_id: string | null; guest_id: string | null }[];
  }[]) {
    // O histórico é por pessoa, não por participação: usamos o id do perfil
    // (resolvido adiante) só para jogadores do grupo; convidados não contam.
    const integrantes = time.team_members
      .map((m) => m.participant_id)
      .filter((id): id is string => Boolean(id));

    const lista = porRodada.get(time.round_id) ?? [];
    lista.push(integrantes);
    porRodada.set(time.round_id, lista);
  }

  // Converte participações em perfis, para a mesma dupla ser reconhecida
  // entre rodadas diferentes.
  const todasAsParticipacoes = [...porRodada.values()].flat().flat();
  if (todasAsParticipacoes.length === 0) return new Map<string, number>();

  const { data: participacoes } = await clienteAdmin()
    .from("round_participants")
    .select("id, profile_id")
    .in("id", todasAsParticipacoes);

  const perfilDe = new Map((participacoes ?? []).map((p) => [p.id, p.profile_id]));

  const rodadasComPerfis = [...porRodada.values()].map((times) => ({
    times: times.map((time) => time.map((id) => perfilDe.get(id) ?? id)),
  }));

  return montarHistoricoDeDuplas(rodadasComPerfis);
}

export interface OpcoesDeSorteio {
  /** Semente própria, para "gerar novamente" dar outro arranjo. */
  semente?: number;
  goleiroExtra?: DestinoDoGoleiroExtra;
}

/** Monta a lista de quem entra no sorteio e roda o algoritmo. */
export async function sortearTimes(
  rodadaId: string,
  opcoes: OpcoesDeSorteio = {},
): Promise<ResultadoDoSorteio & { jogadoresPorId: Map<string, { participacaoId?: string; convidadoId?: string }> }> {
  const [{ rodada, participantes, convidados }, configuracoes, notas] = await Promise.all([
    carregarRodada(rodadaId),
    lerConfiguracoes(),
    notasConsolidadas(),
  ]);

  const confirmados = participantes.filter((p) => p.status === "confirmed");
  const convidadosConfirmados = convidados.filter((c) => c.status === "confirmed");

  if (confirmados.length + convidadosConfirmados.length < rodada.teams_count) {
    throw erroDeRegra(
      "regra_violada",
      "Não há jogadores confirmados suficientes para montar os times.",
    );
  }

  const jogadoresPorId = new Map<string, { participacaoId?: string; convidadoId?: string }>();

  const jogadores: JogadorParaSorteio[] = [
    ...confirmados.map((participacao) => {
      jogadoresPorId.set(participacao.profile_id, { participacaoId: participacao.id });
      const nota = notas.get(participacao.profile_id);

      return {
        // O sorteio raciocina por pessoa: assim o histórico de duplas
        // funciona entre rodadas diferentes.
        id: participacao.profile_id,
        nome: participacao.perfil.nickname?.trim() || participacao.perfil.full_name,
        nota: nota?.nota ?? configuracoes.default_rating,
        ehGoleiro: participacao.perfil.is_goalkeeper,
        pesoKg: participacao.perfil.weight_kg,
        alturaCm: participacao.perfil.height_cm,
        ehConvidado: false,
      } satisfies JogadorParaSorteio;
    }),
    ...convidadosConfirmados.map((convidado) => {
      jogadoresPorId.set(convidado.id, { convidadoId: convidado.id });

      return {
        id: convidado.id,
        nome: convidado.name,
        // O convidado não tem avaliação do grupo: vale o nível que quem
        // levou informou.
        nota: Number(convidado.skill_level),
        ehGoleiro: false,
        pesoKg: null,
        alturaCm: null,
        ehConvidado: true,
      } satisfies JogadorParaSorteio;
    }),
  ];

  const resultado = gerarTimesEquilibrados({
    jogadores,
    quantidadeDeTimes: rodada.teams_count,
    pesos: configuracoes.team_weights,
    historicoDeDuplas: await historicoDeDuplas(
      rodadaId,
      configuracoes.team_weights.repetitionWindow ?? 4,
    ),
    semente: opcoes.semente ?? sementeDeTexto(`${rodadaId}:${Date.now()}`),
    goleiroExtra: opcoes.goleiroExtra ?? "linha",
  });

  return { ...resultado, jogadoresPorId };
}

/** Sorteia e grava. Gerar de novo substitui os times anteriores da rodada. */
export async function gerarEGravarTimes(
  rodadaId: string,
  atorId: string,
  opcoes: OpcoesDeSorteio = {},
): Promise<TimeComIntegrantes[]> {
  const { rodada } = await carregarRodada(rodadaId);
  const resultado = await sortearTimes(rodadaId, opcoes);
  const admin = clienteAdmin();

  // Times antigos saem junto com seus integrantes (cascata no banco).
  await admin.from("teams").delete().eq("round_id", rodadaId);

  const gravados: TimeComIntegrantes[] = [];

  for (const time of resultado.times) {
    const estilo = CORES_DOS_TIMES[(time.indice - 1) % CORES_DOS_TIMES.length]!;

    const { data: timeGravado, error } = await admin
      .from("teams")
      .insert({
        round_id: rodadaId,
        idx: time.indice,
        name: estilo.nome,
        color: estilo.cor,
        rating_total: Math.round(time.somaDeNotas * 100) / 100,
      })
      .select("*")
      .single();

    if (error || !timeGravado) {
      throw erroDeRegra("servico_indisponivel", "Não foi possível gravar os times.");
    }

    const integrantes = time.goleiro ? [time.goleiro, ...time.linha] : time.linha;

    const linhas = integrantes.map((jogador) => {
      const referencia = resultado.jogadoresPorId.get(jogador.id);
      return {
        team_id: timeGravado.id,
        participant_id: referencia?.participacaoId ?? null,
        guest_id: referencia?.convidadoId ?? null,
        is_goalkeeper: time.goleiro?.id === jogador.id,
        rating_snapshot: Math.round(jogador.nota * 10) / 10,
      };
    });

    if (linhas.length > 0) {
      await admin.from("team_members").insert(linhas);
    }

    gravados.push({
      ...timeGravado,
      integrantes: integrantes.map((jogador, i) => ({
        id: `${timeGravado.id}-${i}`,
        team_id: timeGravado.id,
        participant_id: resultado.jogadoresPorId.get(jogador.id)?.participacaoId ?? null,
        guest_id: resultado.jogadoresPorId.get(jogador.id)?.convidadoId ?? null,
        is_goalkeeper: time.goleiro?.id === jogador.id,
        rating_snapshot: jogador.nota,
        created_at: new Date().toISOString(),
        nome: jogador.nome,
        ehGoleiro: time.goleiro?.id === jogador.id,
        ehConvidado: jogador.ehConvidado,
      })),
    });
  }

  await registrarAuditoria({
    atorId,
    acao: "times.gerados",
    entidade: "rounds",
    entidadeId: rodadaId,
    depois: {
      times: resultado.times.map((t) => ({ indice: t.indice, soma: t.somaDeNotas })),
      custo: Math.round(resultado.custo * 1000) / 1000,
      avisos: resultado.avisos,
    },
  });

  const { data: confirmados } = await admin
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .eq("status", "confirmed");

  await notificar({
    destinatarios: (confirmados ?? []).map((p) => p.profile_id),
    tipo: "times.gerados",
    titulo: "Times sorteados! ⚽",
    corpo: `Os times de ${nomeDaRodada(rodada)} já estão no aplicativo.`,
    url: `/racha/${rodadaId}/times`,
  });

  return gravados;
}

/** Times já gravados da rodada, com os nomes resolvidos. */
export async function timesDaRodada(rodadaId: string): Promise<TimeComIntegrantes[]> {
  const { data } = await clienteAdmin()
    .from("teams")
    .select(
      `*, team_members(
        *,
        participacao:round_participants(id, profile_id, perfil:profiles!round_participants_profile_id_fkey(full_name, nickname, is_goalkeeper)),
        convidado:round_guests(id, name)
      )`,
    )
    .eq("round_id", rodadaId)
    .order("idx", { ascending: true });

  type LinhaBruta = Team & {
    team_members: (TeamMember & {
      participacao: {
        id: string;
        profile_id: string;
        perfil: { full_name: string; nickname: string | null; is_goalkeeper: boolean };
      } | null;
      convidado: { id: string; name: string } | null;
    })[];
  };

  return ((data ?? []) as unknown as LinhaBruta[]).map((time) => ({
    ...time,
    integrantes: time.team_members
      .map((integrante) => ({
        ...integrante,
        nome:
          integrante.participacao?.perfil.nickname?.trim() ||
          integrante.participacao?.perfil.full_name ||
          integrante.convidado?.name ||
          "Jogador",
        ehGoleiro: integrante.is_goalkeeper,
        ehConvidado: Boolean(integrante.guest_id),
      }))
      // Goleiro sempre primeiro na escalação.
      .sort((a, b) => Number(b.ehGoleiro) - Number(a.ehGoleiro) || a.nome.localeCompare(b.nome)),
  }));
}

/** Texto pronto para colar no grupo do WhatsApp. */
export function textoParaWhatsapp(
  nomeDoRacha: string,
  times: TimeComIntegrantes[],
): string {
  const linhas = ["⚽ *CANELADA SANTA*", `🔥 *TIMES — ${nomeDoRacha.toUpperCase()}*`, ""];

  times.forEach((time, indice) => {
    const estilo = CORES_DOS_TIMES[indice % CORES_DOS_TIMES.length]!;
    linhas.push(`${estilo.emoji} *${time.name.toUpperCase()}*`);

    for (const integrante of time.integrantes) {
      const icone = integrante.ehGoleiro ? "🧤" : "⚽";
      const marcaDeConvidado = integrante.ehConvidado ? " (convidado)" : "";
      linhas.push(`${icone} ${integrante.nome}${marcaDeConvidado}`);
    }

    linhas.push("");
  });

  linhas.push("_Gerado no aplicativo do Canelada Santa_");
  return linhas.join("\n");
}
