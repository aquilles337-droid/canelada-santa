"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import { baixarCobrancaManualmente, perdoarCobranca } from "@/server/services/cobrancas";
import { gerarMensalidadesDoMes, perdoarMensalidade } from "@/server/services/mensalidades";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

function atualizarFinanceiro(): void {
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/mensalistas");
  revalidatePath("/admin");
  revalidatePath("/perfil/pagamentos");
}

/** Baixa manual: usada quando alguem paga em dinheiro na quadra. */
export async function baixarCobrancaAction(
  cobrancaId: string,
  observacao?: string,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await baixarCobrancaManualmente(cobrancaId, admin.id, observacao);
    atualizarFinanceiro();
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function perdoarCobrancaAction(cobrancaId: string, motivo: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await perdoarCobranca(cobrancaId, admin.id, motivo || "sem motivo informado");
    atualizarFinanceiro();
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function perdoarMensalidadeAction(
  mensalidadeId: string,
  motivo: string,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await perdoarMensalidade(mensalidadeId, admin.id, motivo || "sem motivo informado");
    atualizarFinanceiro();
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function gerarMensalidadesAction(): Promise<Resultado<{ geradas: number }>> {
  try {
    const admin = await exigirAdmin();
    const resultado = await gerarMensalidadesDoMes(new Date(), admin.id);
    atualizarFinanceiro();
    return sucesso({ geradas: resultado.geradas });
  } catch (erro) {
    return comoResultado(erro);
  }
}
