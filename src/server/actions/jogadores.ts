"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirUsuario } from "@/server/auth/sessao";
import {
  atualizarPerfil,
  banirJogador,
  definirMensalista,
  definirPapel,
  desbanirJogador,
  reativarJogador,
  suspenderJogador,
} from "@/server/services/jogadores";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";
import type { Profile } from "@/lib/supabase/tipos";

const POSICOES = ["goleiro", "fixo", "ala", "pivo", "linha"] as const;

const esquemaPerfil = z.object({
  nome: z.string().min(2, "Informe seu nome completo"),
  apelido: z.string().optional(),
  posicao: z.enum(POSICOES),
  goleiro: z.string().optional(),
  peso: z.string().optional(),
  altura: z.string().optional(),
});

function numeroOpcional(valor: string | undefined): number | null {
  if (!valor || !valor.trim()) return null;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** O proprio jogador edita seus dados. Papel e situacao nao passam por aqui. */
export async function salvarMeuPerfil(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<Profile>> {
  try {
    const perfil = await exigirUsuario();

    const bruto = esquemaPerfil.safeParse({
      nome: formulario.get("nome"),
      apelido: formulario.get("apelido") ?? undefined,
      posicao: formulario.get("posicao"),
      goleiro: formulario.get("goleiro") ?? undefined,
      peso: formulario.get("peso") ?? undefined,
      altura: formulario.get("altura") ?? undefined,
    });

    if (!bruto.success) {
      return falha("dados_invalidos", bruto.error.issues[0]?.message ?? "Confira os dados informados.");
    }

    const atualizado = await atualizarPerfil(perfil.id, {
      nome: bruto.data.nome,
      apelido: bruto.data.apelido ?? null,
      posicao: bruto.data.posicao,
      ehGoleiro: bruto.data.goleiro === "on",
      pesoKg: numeroOpcional(bruto.data.peso),
      alturaCm: numeroOpcional(bruto.data.altura),
    });

    revalidatePath("/perfil");
    return sucesso(atualizado);
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function alternarNotificacoes(ativas: boolean): Promise<Resultado> {
  try {
    const perfil = await exigirUsuario();
    await atualizarPerfil(perfil.id, { notificacoesAtivas: ativas });
    revalidatePath("/perfil");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

// ------------------------------------------------------------
// Acoes de administrador
// ------------------------------------------------------------

export async function banirAction(alvoId: string, motivo?: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await banirJogador(alvoId, admin.id, motivo ?? null);
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function desbanirAction(alvoId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await desbanirJogador(alvoId, admin.id);
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function suspenderAction(alvoId: string, motivo?: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await suspenderJogador(alvoId, admin.id, motivo ?? null);
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function reativarAction(alvoId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await reativarJogador(alvoId, admin.id);
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function definirPapelAction(alvoId: string, virarAdmin: boolean): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await definirPapel(alvoId, admin.id, virarAdmin ? "admin" : "player");
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function definirMensalistaAction(alvoId: string, ehMensalista: boolean): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await definirMensalista(alvoId, admin.id, ehMensalista);
    revalidatePath("/admin/jogadores");
    revalidatePath("/admin/mensalistas");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
