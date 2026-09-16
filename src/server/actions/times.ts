"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import { gerarEGravarTimes, type TimeComIntegrantes } from "@/server/services/times";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

/**
 * Gera os times da rodada. Chamar de novo substitui o sorteio anterior —
 * é o "GERAR NOVAMENTE" do painel.
 */
export async function gerarTimesAction(
  rodadaId: string,
  goleiroExtra: "linha" | "fora" = "linha",
): Promise<Resultado<TimeComIntegrantes[]>> {
  try {
    const admin = await exigirAdmin();

    const times = await gerarEGravarTimes(rodadaId, admin.id, {
      // Semente nova a cada clique: o resultado muda sem perder equilíbrio.
      semente: Math.floor(Math.random() * 2_147_483_647),
      goleiroExtra,
    });

    revalidatePath(`/admin/rodadas/${rodadaId}`);
    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/racha/${rodadaId}/times`);
    return sucesso(times);
  } catch (erro) {
    return comoResultado(erro);
  }
}
