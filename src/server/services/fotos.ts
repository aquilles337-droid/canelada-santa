import "server-only";

import { randomUUID } from "node:crypto";
import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { Profile, RoundPhoto } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";

/**
 * Fotos.
 *
 * O envio passa pelo servidor de propósito: é onde o tipo e o tamanho do
 * arquivo são conferidos antes de qualquer coisa ser gravada. O nome do
 * arquivo é sorteado, então ninguém descobre a foto de outra rodada
 * adivinhando o endereço.
 */

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

function conferirArquivo(arquivo: File, limite = TAMANHO_MAXIMO): void {
  if (!TIPOS_ACEITOS.includes(arquivo.type as (typeof TIPOS_ACEITOS)[number])) {
    throw erroDeRegra("dados_invalidos", "Envie uma imagem JPG, PNG ou WEBP.");
  }
  if (arquivo.size > limite) {
    throw erroDeRegra(
      "dados_invalidos",
      `A imagem precisa ter no máximo ${Math.round(limite / 1024 / 1024)} MB.`,
    );
  }
  if (arquivo.size === 0) {
    throw erroDeRegra("dados_invalidos", "O arquivo enviado está vazio.");
  }
}

function extensaoDe(tipo: string): string {
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

export async function enviarFotoDaRodada(
  rodadaId: string,
  arquivo: File,
  admin: Profile,
  legenda?: string | null,
): Promise<RoundPhoto> {
  conferirArquivo(arquivo);

  const caminho = `${rodadaId}/${randomUUID()}.${extensaoDe(arquivo.type)}`;
  const cliente = clienteAdmin();

  const { error: erroDeEnvio } = await cliente.storage
    .from("fotos-rodadas")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  if (erroDeEnvio) {
    console.error("[canelada] falha ao enviar foto da rodada", erroDeEnvio);
    throw erroDeRegra("servico_indisponivel", "Não foi possível enviar a foto agora.");
  }

  const { data, error } = await cliente
    .from("round_photos")
    .insert({
      round_id: rodadaId,
      storage_path: caminho,
      caption: legenda?.trim() || null,
      uploaded_by: admin.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    // A imagem já subiu; sem a linha no banco ela viraria lixo no armazenamento.
    await cliente.storage.from("fotos-rodadas").remove([caminho]).catch(() => undefined);
    throw erroDeRegra("servico_indisponivel", "Não foi possível salvar a foto agora.");
  }

  await registrarAuditoria({
    atorId: admin.id,
    acao: "rodada.alterada",
    entidade: "round_photos",
    entidadeId: data.id,
    depois: { rodada: rodadaId, foto: caminho },
  });

  return data;
}

export async function removerFotoDaRodada(fotoId: string, admin: Profile): Promise<void> {
  const cliente = clienteAdmin();

  const { data: foto } = await cliente.from("round_photos").select("*").eq("id", fotoId).maybeSingle();
  if (!foto) return;

  await cliente.storage.from("fotos-rodadas").remove([foto.storage_path]);
  await cliente.from("round_photos").delete().eq("id", fotoId);

  await registrarAuditoria({
    atorId: admin.id,
    acao: "rodada.alterada",
    entidade: "round_photos",
    entidadeId: fotoId,
    antes: { foto: foto.storage_path },
  });
}

/** Endereço público da imagem. */
export function enderecoDaFoto(caminho: string, balde = "fotos-rodadas"): string {
  const { data } = clienteAdmin().storage.from(balde).getPublicUrl(caminho);
  return data.publicUrl;
}

export interface FotoComEndereco extends RoundPhoto {
  url: string;
}

export async function fotosDaRodada(rodadaId: string): Promise<FotoComEndereco[]> {
  const { data } = await clienteAdmin()
    .from("round_photos")
    .select("*")
    .eq("round_id", rodadaId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((foto) => ({ ...foto, url: enderecoDaFoto(foto.storage_path) }));
}

/** Retrato do jogador. Cada um troca o próprio. */
export async function enviarFotoDePerfil(perfil: Profile, arquivo: File): Promise<string> {
  conferirArquivo(arquivo, 4 * 1024 * 1024);

  const caminho = `${perfil.id}/${randomUUID()}.${extensaoDe(arquivo.type)}`;
  const cliente = clienteAdmin();

  const { error: erroDeEnvio } = await cliente.storage
    .from("fotos-perfil")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  if (erroDeEnvio) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível enviar sua foto agora.");
  }

  const url = enderecoDaFoto(caminho, "fotos-perfil");

  const { error } = await cliente.from("profiles").update({ photo_url: url }).eq("id", perfil.id);
  if (error) {
    await cliente.storage.from("fotos-perfil").remove([caminho]).catch(() => undefined);
    throw erroDeRegra("servico_indisponivel", "Não foi possível salvar sua foto agora.");
  }

  // A foto antiga sai do armazenamento para não acumular lixo.
  if (perfil.photo_url) {
    const anterior = perfil.photo_url.split("/fotos-perfil/")[1];
    if (anterior) {
      await cliente.storage.from("fotos-perfil").remove([anterior]).catch(() => undefined);
    }
  }

  return url;
}
