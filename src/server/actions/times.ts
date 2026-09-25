"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import { gerarEGravarTimes, type EscalacaoDaRodada } from "@/server/services/times";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

/**
 * Gera os times da rodada. Chamar de novo substitui o sorteio anterior —
 * é o "GERAR NOVAMENTE" do painel.
 */
export async function gerarTimesAction(rodadaId: string): Promise<Resultado<EscalacaoDaRodada>> {
  try {
    const admin = await exigirAdmin();

    const escalacao = await gerarEGravarTimes(rodadaId, admin.id, {
      // Semente nova a cada clique: o resultado muda sem perder equilíbrio.
      semente: Math.floor(Math.random() * 2_147_483_647),
    });

    revalidatePath(`/admin/rodadas/${rodadaId}`);
    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/racha/${rodadaId}/times`);
    revalidatePath(`/racha/${rodadaId}/jogo`);
    return sucesso(escalacao);
  } catch (erro) {
    return comoResultado(erro);
  }
}
