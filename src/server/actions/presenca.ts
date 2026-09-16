"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, exigirAtivo } from "@/server/auth/sessao";
import {
  aceitarVaga,
  cancelarPresenca,
  confirmarPresenca,
  promoverFilaDaRodada,
  removerParticipante,
} from "@/server/services/presenca";
import { formatarDinheiro } from "@/lib/format";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

function atualizarTelas(rodadaId: string): void {
  revalidatePath("/inicio");
  revalidatePath("/racha");
  revalidatePath(`/racha/${rodadaId}`);
  revalidatePath(`/admin/rodadas/${rodadaId}`);
  revalidatePath("/admin");
}

export interface RespostaDePresenca {
  mensagem: string;
  entrouNaVaga: boolean;
  posicaoNaEspera: number | null;
}

/** O jogador apertou VOU. */
export async function confirmarPresencaAction(rodadaId: string): Promise<Resultado<RespostaDePresenca>> {
  try {
    const perfil = await exigirAtivo();
    const resultado = await confirmarPresenca(rodadaId, perfil);

    atualizarTelas(rodadaId);

    return sucesso({
      entrouNaVaga: resultado.entrouNaVaga,
      posicaoNaEspera: resultado.posicaoNaEspera,
      mensagem: resultado.entrouNaVaga
        ? "Presença confirmada! Te esperamos na quadra. ⚽"
        : resultado.posicaoNaEspera
          ? `Você entrou na lista de espera, na ${resultado.posicaoNaEspera}ª posição. Avisamos se abrir vaga.`
          : "Você entrou na lista de espera. Avisamos se abrir vaga.",
    });
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** O jogador apertou NÃO VOU ou retirou o nome. */
export async function cancelarPresencaAction(rodadaId: string): Promise<Resultado<{ mensagem: string }>> {
  try {
    const perfil = await exigirAtivo();
    const resultado = await cancelarPresenca(rodadaId, perfil);

    atualizarTelas(rodadaId);

    return sucesso({
      mensagem: resultado.geraMulta
        ? `Nome retirado. Como passou do prazo, foi gerada uma multa de ${formatarDinheiro(resultado.valorDaMultaCentavos)}.`
        : "Nome retirado. Até o próximo racha!",
    });
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** O jogador aceitou a vaga que abriu na lista de espera. */
export async function aceitarVagaAction(rodadaId: string): Promise<Resultado<{ mensagem: string }>> {
  try {
    const perfil = await exigirAtivo();
    await aceitarVaga(rodadaId, perfil);

    atualizarTelas(rodadaId);
    return sucesso({ mensagem: "Vaga garantida! Te esperamos na quadra. ⚽" });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function removerParticipanteAction(
  rodadaId: string,
  participacaoId: string,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await removerParticipante(rodadaId, participacaoId, admin.id);
    atualizarTelas(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Chama manualmente a proxima pessoa da fila. */
export async function promoverFilaAction(rodadaId: string): Promise<Resultado<{ chamados: number }>> {
  try {
    await exigirAdmin();
    const chamados = await promoverFilaDaRodada(rodadaId);
    atualizarTelas(rodadaId);
    return sucesso({ chamados });
  } catch (erro) {
    return comoResultado(erro);
  }
}
