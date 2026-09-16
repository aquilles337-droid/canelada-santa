"use server";

import { revalidatePath } from "next/cache";
import { exigirAtivo } from "@/server/auth/sessao";
import { adicionarConvidado, removerConvidado } from "@/server/services/convidados";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";
import type { RoundGuest } from "@/lib/supabase/tipos";

export async function adicionarConvidadoAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<RoundGuest>> {
  try {
    const perfil = await exigirAtivo();

    const rodadaId = String(formulario.get("rodadaId") ?? "");
    const nome = String(formulario.get("nome") ?? "");
    const nivel = Number(String(formulario.get("nivel") ?? "5").replace(",", "."));

    if (!rodadaId) return falha("dados_invalidos", "Racha não informado.");

    const convidado = await adicionarConvidado(rodadaId, perfil, nome, nivel);

    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/admin/rodadas/${rodadaId}`);
    return sucesso(convidado);
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function removerConvidadoAction(
  convidadoId: string,
  rodadaId: string,
): Promise<Resultado> {
  try {
    const perfil = await exigirAtivo();
    await removerConvidado(convidadoId, perfil);

    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/admin/rodadas/${rodadaId}`);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
