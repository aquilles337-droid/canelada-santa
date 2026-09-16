"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { emailDoTelefone, normalizarTelefone } from "@/lib/phone";
import { comoResultado, erroDeRegra, falha, sucesso, type Resultado } from "@/lib/erros";

/**
 * Entrada e saida do aplicativo.
 *
 * O jogador informa telefone e senha. Internamente o Supabase Auth guarda um
 * e-mail sintetico derivado do telefone (ver src/lib/phone.ts) — isso evita
 * depender de um provedor de SMS pago sem mudar nada para quem usa.
 */

const esquemaEntrada = z.object({
  telefone: z.string().min(1, "Informe seu telefone"),
  senha: z.string().min(1, "Informe sua senha"),
});

export async function entrar(_anterior: unknown, formulario: FormData): Promise<Resultado<{ destino: string }>> {
  try {
    const dados = esquemaEntrada.safeParse({
      telefone: formulario.get("telefone"),
      senha: formulario.get("senha"),
    });

    if (!dados.success) {
      return falha("dados_invalidos", dados.error.issues[0]?.message ?? "Preencha telefone e senha.");
    }

    const telefone = normalizarTelefone(dados.data.telefone);
    if (!telefone) {
      return falha("dados_invalidos", "Telefone inválido. Use DDD + número.");
    }

    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailDoTelefone(telefone, env().NEXT_PUBLIC_PHONE_EMAIL_DOMAIN),
      password: dados.data.senha,
    });

    if (error) {
      // Nao revelamos se o telefone existe: a resposta e a mesma nos dois casos.
      return falha("dados_invalidos", "Telefone ou senha incorretos.");
    }

    // Banido nao entra. A sessao e encerrada imediatamente.
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: perfil } = await clienteAdmin()
        .from("profiles")
        .select("status")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (perfil?.status === "banned") {
        await supabase.auth.signOut();
        return falha("sem_permissao", "Seu acesso está bloqueado. Fale com um administrador.");
      }
    }

    const destinoBruto = formulario.get("destino");
    // Só aceitamos caminho interno, para o parametro nao virar redirecionamento externo.
    const destino =
      typeof destinoBruto === "string" && /^\/[A-Za-z0-9\-._~/]*$/.test(destinoBruto) ? destinoBruto : "/inicio";

    return sucesso({ destino });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function sair(): Promise<never> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/** Troca de senha do proprio usuario. */
export async function trocarSenha(_anterior: unknown, formulario: FormData): Promise<Resultado> {
  try {
    const nova = String(formulario.get("nova") ?? "");
    const confirmacao = String(formulario.get("confirmacao") ?? "");

    if (nova.length < 6) {
      throw erroDeRegra("dados_invalidos", "A senha precisa ter pelo menos 6 caracteres.");
    }
    if (nova !== confirmacao) {
      throw erroDeRegra("dados_invalidos", "As senhas não são iguais.");
    }

    const supabase = await criarClienteServidor();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      throw erroDeRegra("nao_autenticado", "Entre na sua conta para continuar.");
    }

    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) {
      throw erroDeRegra("servico_indisponivel", "Não foi possível trocar a senha agora.");
    }

    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
