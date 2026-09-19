"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import { baixarCobrancaManualmente, perdoarCobranca, reabrirCobranca } from "@/server/services/cobrancas";
import {
  atualizarValorDasMensalidades,
  gerarMensalidadesDoMes,
  marcarMensalidadePaga,
  perdoarMensalidade,
  reabrirMensalidade,
} from "@/server/services/mensalidades";
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

/** Baixa manual da mensalidade: para quem pagou em dinheiro na quadra. */
export async function quitarMensalidadeAction(mensalidadeId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await marcarMensalidadePaga(mensalidadeId, admin.id);
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

/** Desfaz um perdão: a cobrança volta a ficar em aberto. */
export async function reabrirCobrancaAction(cobrancaId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await reabrirCobranca(cobrancaId, admin.id);
    atualizarFinanceiro();
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Volta a cobrar uma mensalidade perdoada ou cancelada. */
export async function reabrirMensalidadeAction(mensalidadeId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await reabrirMensalidade(mensalidadeId, admin.id);
    atualizarFinanceiro();
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Passa o valor configurado hoje para as mensalidades do mes ainda em aberto. */
export async function atualizarValorDasMensalidadesAction(): Promise<
  Resultado<{ atualizadas: number; valorCentavos: number }>
> {
  try {
    const admin = await exigirAdmin();
    const resultado = await atualizarValorDasMensalidades(admin.id);
    atualizarFinanceiro();
    return sucesso(resultado);
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
