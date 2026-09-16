import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { erroDeRegra } from "@/lib/erros";
import { emailDoTelefone, normalizarTelefone } from "@/lib/phone";
import type { PlayerPosition, Profile } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { devolverUsoDoConvite, reservarUsoDoConvite, validarConvite } from "./convites";

/**
 * Cadastro de um novo jogador a partir de um convite.
 *
 * O cuidado central aqui e nao deixar lixo para tras: se a criacao do perfil
 * falhar depois que a conta de acesso ja existe, a conta e apagada e o uso
 * do convite e devolvido. O grupo nunca fica com um cadastro pela metade.
 */
export interface DadosDeCadastro {
  codigoConvite: string;
  nome: string;
  telefone: string;
  senha: string;
  posicao: PlayerPosition;
  ehGoleiro: boolean;
  pesoKg?: number | null;
  alturaCm?: number | null;
}

export async function cadastrarComConvite(dados: DadosDeCadastro): Promise<Profile> {
  const nome = dados.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) {
    throw erroDeRegra("dados_invalidos", "Informe seu nome completo.");
  }
  if (dados.senha.length < 6) {
    throw erroDeRegra("dados_invalidos", "A senha precisa ter pelo menos 6 caracteres.");
  }

  const telefone = normalizarTelefone(dados.telefone);
  if (!telefone) {
    throw erroDeRegra("dados_invalidos", "Telefone inválido. Use DDD + número.");
  }

  const convite = await validarConvite(dados.codigoConvite);

  // Checagem antecipada, so para dar uma mensagem melhor. A garantia real e
  // a restricao de unicidade da coluna phone.
  const { data: jaExiste } = await clienteAdmin()
    .from("profiles")
    .select("id")
    .eq("phone", telefone)
    .maybeSingle();

  if (jaExiste) {
    throw erroDeRegra("conflito", "Este telefone já tem conta no Canelada Santa. Tente entrar.");
  }

  await reservarUsoDoConvite(convite);

  const admin = clienteAdmin();
  const email = emailDoTelefone(telefone, env().NEXT_PUBLIC_PHONE_EMAIL_DOMAIN);

  const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
    email,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { telefone, nome },
  });

  if (erroAuth || !criado.user) {
    await devolverUsoDoConvite(convite.id);
    if (erroAuth?.message?.includes("already been registered")) {
      throw erroDeRegra("conflito", "Este telefone já tem conta no Canelada Santa. Tente entrar.");
    }
    throw erroDeRegra("servico_indisponivel", "Não foi possível criar sua conta agora.");
  }

  const { data: perfil, error: erroPerfil } = await admin
    .from("profiles")
    .insert({
      id: criado.user.id,
      full_name: nome,
      phone: telefone,
      position: dados.posicao,
      is_goalkeeper: dados.ehGoleiro,
      weight_kg: dados.pesoKg ?? null,
      height_cm: dados.alturaCm ?? null,
      role: "player",
      status: "active",
      is_member: false,
    })
    .select("*")
    .single();

  if (erroPerfil || !perfil) {
    // Desfaz tudo para nao sobrar conta de acesso sem jogador.
    await admin.auth.admin.deleteUser(criado.user.id).catch(() => undefined);
    await devolverUsoDoConvite(convite.id);

    if (erroPerfil?.code === "23505") {
      throw erroDeRegra("conflito", "Este telefone já tem conta no Canelada Santa. Tente entrar.");
    }
    throw erroDeRegra("servico_indisponivel", "Não foi possível concluir seu cadastro agora.");
  }

  await registrarAuditoria({
    atorId: perfil.id,
    acao: "jogador.cadastrado",
    entidade: "profiles",
    entidadeId: perfil.id,
    depois: { nome: perfil.full_name, convite: convite.code },
  });

  return perfil;
}
