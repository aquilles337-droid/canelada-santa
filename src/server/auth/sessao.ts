import "server-only";

import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { Profile } from "@/lib/supabase/tipos";

/**
 * Sessao do Canelada Santa.
 *
 * Toda Server Action e toda pagina protegida passam por aqui. O perfil e
 * lido uma vez por requisicao (React cache) e e a unica fonte de verdade
 * sobre papel e situacao do jogador — o cliente nunca informa quem e.
 */

export const usuarioAtual = cache(async (): Promise<Profile | null> => {
  const supabase = await criarClienteServidor();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // Lemos o perfil com service role para que o proprio RLS de profiles
  // nunca esconda o usuario dele mesmo (caso de banido, por exemplo).
  const { data, error } = await clienteAdmin()
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
});

/** Exige alguem logado. */
export async function exigirUsuario(): Promise<Profile> {
  const perfil = await usuarioAtual();
  if (!perfil) {
    throw erroDeRegra("nao_autenticado", "Entre na sua conta para continuar.");
  }
  return perfil;
}

/**
 * Exige um jogador em situacao regular. Banido e suspenso continuam
 * conseguindo ver o proprio historico, mas nao executam acoes.
 */
export async function exigirAtivo(): Promise<Profile> {
  const perfil = await exigirUsuario();

  if (perfil.status === "banned") {
    throw erroDeRegra("sem_permissao", "Seu acesso está bloqueado. Fale com um administrador.");
  }
  if (perfil.status === "suspended") {
    throw erroDeRegra("sem_permissao", "Sua conta está suspensa no momento.");
  }
  if (perfil.status === "inactive") {
    throw erroDeRegra("sem_permissao", "Sua conta está inativa. Fale com um administrador.");
  }

  return perfil;
}

/** Exige administrador. Lembrando que administrador tambem joga. */
export async function exigirAdmin(): Promise<Profile> {
  const perfil = await exigirAtivo();
  if (perfil.role !== "admin") {
    throw erroDeRegra("sem_permissao", "Esta área é só para administradores.");
  }
  return perfil;
}

export async function ehAdmin(): Promise<boolean> {
  const perfil = await usuarioAtual();
  return perfil?.role === "admin" && perfil.status === "active";
}
