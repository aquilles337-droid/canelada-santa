import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { avaliarFalta } from "@/domain/presenca";
import { chaveDeCobranca } from "@/domain/cobrancas";
import type { AttendanceStatus, Profile } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { cancelarCobranca, cobrarMulta } from "./cobrancas";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";
import { carregarRodada, nomeDaRodada, rodadaParaDominio } from "./rodadas";

/**
 * Controle de presença, feito pelo administrador depois do racha.
 *
 * Falta justificada não gera multa. Falta sem aviso gera a multa maior,
 * calculada com as regras da própria rodada — mudar a configuração hoje não
 * reescreve multa de racha antigo.
 *
 * Marcar de novo corrige o que foi marcado errado: a multa anterior é
 * cancelada antes de qualquer nova ser criada.
 */

export interface MarcacaoDePresenca {
  participacaoId: string;
  situacao: AttendanceStatus;
  justificada?: boolean;
  observacao?: string | null;
}

export async function marcarPresenca(
  rodadaId: string,
  marcacao: MarcacaoDePresenca,
  admin: Profile,
): Promise<void> {
  const [{ rodada, participantes }, configuracoes] = await Promise.all([
    carregarRodada(rodadaId),
    lerConfiguracoes(),
  ]);

  const participacao = participantes.find((p) => p.id === marcacao.participacaoId);
  if (!participacao) throw erroDeRegra("nao_encontrado", "Jogador não encontrado nesta rodada.");

  const justificada = marcacao.situacao === "absent" ? (marcacao.justificada ?? false) : null;

  const { error } = await clienteAdmin()
    .from("round_participants")
    .update({
      attendance: marcacao.situacao,
      absence_justified: justificada,
      absence_note: marcacao.situacao === "absent" ? (marcacao.observacao ?? null) : null,
      attendance_marked_by: admin.id,
      attendance_marked_at: new Date().toISOString(),
    })
    .eq("id", marcacao.participacaoId);

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível marcar a presença.");
  }

  const chaveDaMulta = chaveDeCobranca("fine", {
    rodadaId,
    profileId: participacao.profile_id,
    motivo: "no_show",
  });

  // Correção de marcação: a multa antiga sai antes de decidir de novo.
  await cancelarCobranca(chaveDaMulta, admin.id, "presença remarcada");

  if (marcacao.situacao === "absent") {
    const avaliacao = avaliarFalta(rodadaParaDominio(rodada), justificada ?? false);

    if (avaliacao.geraMulta) {
      await cobrarMulta(
        rodada,
        participacao.perfil,
        "no_show",
        avaliacao.valorCentavos,
        admin.id,
      );
    }
  }

  // A cobrança do jogo avulso some quando quem faltou não vai pagar por ele.
  if (
    marcacao.situacao === "absent" &&
    !configuracoes.keep_match_charge_on_no_show &&
    participacao.kind === "casual"
  ) {
    await cancelarCobranca(
      chaveDeCobranca("match", { rodadaId, profileId: participacao.profile_id }),
      admin.id,
      "jogador faltou",
    );
  }

  await registrarAuditoria({
    atorId: admin.id,
    acao: justificada ? "presenca.falta_justificada" : "presenca.marcada",
    entidade: "round_participants",
    entidadeId: marcacao.participacaoId,
    depois: {
      jogador: participacao.perfil.full_name,
      rodada: nomeDaRodada(rodada),
      situacao: marcacao.situacao,
      justificada,
    },
  });
}

/** Marca todo mundo que ainda está pendente como presente, de uma vez. */
export async function marcarTodosComoPresentes(rodadaId: string, admin: Profile): Promise<number> {
  const { data } = await clienteAdmin()
    .from("round_participants")
    .update({
      attendance: "present",
      attendance_marked_by: admin.id,
      attendance_marked_at: new Date().toISOString(),
    })
    .eq("round_id", rodadaId)
    .eq("status", "confirmed")
    .eq("attendance", "pending")
    .select("id");

  return data?.length ?? 0;
}

/** Abre a votação de craque e bagre e avisa quem jogou. */
export async function abrirVotacaoDaRodada(rodadaId: string): Promise<void> {
  const { rodada, participantes } = await carregarRodada(rodadaId);

  const presentes = participantes
    .filter((p) => p.attendance === "present")
    .map((p) => p.profile_id);

  if (presentes.length === 0) return;

  await notificar({
    destinatarios: presentes,
    tipo: "votacao.craque",
    titulo: "Votação aberta! 🏆",
    corpo: `Escolha o craque e o bagre de ${nomeDaRodada(rodada)}.`,
    url: `/racha/${rodadaId}/votacao`,
  });
}
