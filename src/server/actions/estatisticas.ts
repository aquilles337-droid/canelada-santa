"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, exigirAtivo } from "@/server/auth/sessao";
import {
  abrirVotacaoDaRodada,
  marcarPresenca,
  marcarTodosComoPresentes,
  type MarcacaoDePresenca,
} from "@/server/services/controleDePresenca";
import { registrarVoto } from "@/server/services/votacao";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";
import type { VoteKind } from "@/lib/supabase/tipos";

function atualizar(rodadaId: string): void {
  revalidatePath(`/admin/rodadas/${rodadaId}/presenca`);
  revalidatePath(`/admin/rodadas/${rodadaId}`);
  revalidatePath(`/racha/${rodadaId}`);
  revalidatePath(`/racha/${rodadaId}/votacao`);
  revalidatePath("/ranking");
}

export async function marcarPresencaAction(
  rodadaId: string,
  marcacao: MarcacaoDePresenca,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await marcarPresenca(rodadaId, marcacao, admin);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function marcarTodosPresentesAction(
  rodadaId: string,
): Promise<Resultado<{ marcados: number }>> {
  try {
    const admin = await exigirAdmin();
    const marcados = await marcarTodosComoPresentes(rodadaId, admin);

    atualizar(rodadaId);
    return sucesso({ marcados });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function abrirVotacaoAction(rodadaId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await abrirVotacaoDaRodada(rodadaId);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Voto de craque ou bagre. Anônimo, só para quem jogou. */
export async function votarAction(
  rodadaId: string,
  escolhidoId: string,
  tipo: VoteKind,
): Promise<Resultado> {
  try {
    const perfil = await exigirAtivo();
    await registrarVoto(rodadaId, perfil, escolhidoId, tipo);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
