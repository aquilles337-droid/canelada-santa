"use server";

import { revalidatePath } from "next/cache";
import { exigirAtivo } from "@/server/auth/sessao";
import { avaliarJogador, removerAvaliacao } from "@/server/services/avaliacoes";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

/** Avaliação anônima de 0 a 10. Ninguém avalia a si mesmo. */
export async function avaliarAction(avaliadoId: string, nota: number): Promise<Resultado> {
  try {
    const perfil = await exigirAtivo();
    await avaliarJogador(perfil, avaliadoId, nota);

    revalidatePath("/ranking");
    revalidatePath("/avaliar");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function removerAvaliacaoAction(avaliadoId: string): Promise<Resultado> {
  try {
    const perfil = await exigirAtivo();
    await removerAvaliacao(perfil.id, avaliadoId);

    revalidatePath("/avaliar");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
