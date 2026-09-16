import "server-only";

import { randomInt } from "node:crypto";
import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { Invitation } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";

/**
 * Convites.
 *
 * Nao existe cadastro publico no Canelada Santa: so entra quem recebeu um
 * convite de um administrador. O convite pode circular como link, codigo
 * digitado ou QR Code — os tres apontam para o mesmo codigo.
 */

// Sem I, O, 0 e 1: o codigo e ditado no grupo e precisa ser inconfundivel.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 8;

export function gerarCodigoDeConvite(): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

export interface NovoConvite {
  criadoPor: string;
  maxUsos?: number;
  validoPorDias?: number | null;
  nota?: string | null;
}

export async function criarConvite(entrada: NovoConvite): Promise<Invitation> {
  const maxUsos = entrada.maxUsos ?? 1;
  if (maxUsos < 1 || maxUsos > 100) {
    throw erroDeRegra("dados_invalidos", "A quantidade de usos precisa ficar entre 1 e 100.");
  }

  const expiraEm =
    entrada.validoPorDias && entrada.validoPorDias > 0
      ? new Date(Date.now() + entrada.validoPorDias * 86_400_000).toISOString()
      : null;

  // Colisao de codigo e improvavel, mas nao impossivel: tentamos de novo.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoDeConvite();
    const { data, error } = await clienteAdmin()
      .from("invitations")
      .insert({
        code: codigo,
        max_uses: maxUsos,
        expires_at: expiraEm,
        note: entrada.nota ?? null,
        created_by: entrada.criadoPor,
      })
      .select("*")
      .single();

    if (!error && data) {
      await registrarAuditoria({
        atorId: entrada.criadoPor,
        acao: "convite.criado",
        entidade: "invitations",
        entidadeId: data.id,
        depois: { codigo: data.code, max_usos: data.max_uses, expira_em: data.expires_at },
      });
      return data;
    }

    // 23505 = violacao de unicidade; qualquer outro erro nao se resolve tentando de novo.
    if (error && error.code !== "23505") break;
  }

  throw erroDeRegra("servico_indisponivel", "Não foi possível gerar o convite agora.");
}

/** Le o convite e explica, em português, por que ele nao serve mais. */
export async function validarConvite(codigo: string): Promise<Invitation> {
  const normalizado = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(normalizado)) {
    throw erroDeRegra("nao_encontrado", "Convite inválido.");
  }

  const { data } = await clienteAdmin()
    .from("invitations")
    .select("*")
    .eq("code", normalizado)
    .maybeSingle();

  if (!data) {
    throw erroDeRegra("nao_encontrado", "Convite inválido.");
  }
  if (data.revoked_at) {
    throw erroDeRegra("regra_violada", "Este convite foi cancelado.");
  }
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    throw erroDeRegra("prazo_expirado", "Este convite expirou. Peça um novo a um administrador.");
  }
  if (data.uses >= data.max_uses) {
    throw erroDeRegra("regra_violada", "Este convite já foi usado.");
  }

  return data;
}

/**
 * Reserva um uso do convite. A condicao `uses < max_uses` vai no proprio
 * UPDATE, entao duas pessoas abrindo o mesmo link ao mesmo tempo nao
 * conseguem consumir a mesma vaga.
 */
export async function reservarUsoDoConvite(convite: Invitation): Promise<void> {
  const { data, error } = await clienteAdmin()
    .from("invitations")
    .update({ uses: convite.uses + 1 })
    .eq("id", convite.id)
    .eq("uses", convite.uses)
    .is("revoked_at", null)
    .select("id");

  if (error || !data || data.length === 0) {
    throw erroDeRegra("conflito", "Este convite acabou de ser usado. Peça um novo.");
  }
}

/** Devolve o uso reservado quando o cadastro falha no meio do caminho. */
export async function devolverUsoDoConvite(conviteId: string): Promise<void> {
  try {
    const { data } = await clienteAdmin()
      .from("invitations")
      .select("uses")
      .eq("id", conviteId)
      .maybeSingle();

    if (data && data.uses > 0) {
      await clienteAdmin().from("invitations").update({ uses: data.uses - 1 }).eq("id", conviteId);
    }
  } catch (erro) {
    console.error("[canelada] falha ao devolver uso do convite", conviteId, erro);
  }
}

export async function revogarConvite(conviteId: string, atorId: string): Promise<void> {
  const { error } = await clienteAdmin()
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", conviteId)
    .is("revoked_at", null);

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível cancelar o convite agora.");
  }

  await registrarAuditoria({
    atorId,
    acao: "convite.revogado",
    entidade: "invitations",
    entidadeId: conviteId,
  });
}

export async function listarConvites(): Promise<Invitation[]> {
  const { data } = await clienteAdmin()
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return data ?? [];
}
