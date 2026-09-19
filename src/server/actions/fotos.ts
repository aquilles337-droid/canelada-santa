"use server";

import { revalidatePath } from "next/cache";
import { exigirAtivo } from "@/server/auth/sessao";
import { enviarFotoDaRodada, enviarFotoDePerfil, removerFotoDaRodada } from "@/server/services/fotos";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";

/** Foto da rodada. Qualquer jogador do grupo pode publicar. */
export async function enviarFotoDaRodadaAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<{ url: string }>> {
  try {
    const perfil = await exigirAtivo();

    const rodadaId = String(formulario.get("rodadaId") ?? "");
    const arquivo = formulario.get("foto");
    const legenda = String(formulario.get("legenda") ?? "");

    if (!rodadaId) return falha("dados_invalidos", "Racha não informado.");
    if (!(arquivo instanceof File)) return falha("dados_invalidos", "Escolha uma imagem.");

    const foto = await enviarFotoDaRodada(rodadaId, arquivo, perfil, legenda);

    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/admin/rodadas/${rodadaId}`);
    return sucesso({ url: foto.storage_path });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function removerFotoDaRodadaAction(
  fotoId: string,
  rodadaId: string,
): Promise<Resultado> {
  try {
    const perfil = await exigirAtivo();
    // O serviço confere se é o dono ou um administrador.
    await removerFotoDaRodada(fotoId, perfil);

    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath(`/admin/rodadas/${rodadaId}`);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Retrato do jogador. Cada um troca somente o próprio. */
export async function enviarFotoDePerfilAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<{ url: string }>> {
  try {
    const perfil = await exigirAtivo();
    const arquivo = formulario.get("foto");

    if (!(arquivo instanceof File)) return falha("dados_invalidos", "Escolha uma imagem.");

    const url = await enviarFotoDePerfil(perfil, arquivo);

    revalidatePath("/perfil");
    revalidatePath("/ranking");
    return sucesso({ url });
  } catch (erro) {
    return comoResultado(erro);
  }
}
