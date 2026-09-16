"use server";

import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { emailDoTelefone, normalizarTelefone } from "@/lib/phone";
import { cadastrarComConvite } from "@/server/services/cadastro";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";

const POSICOES = ["goleiro", "fixo", "ala", "pivo", "linha"] as const;

const esquema = z.object({
  codigo: z.string().min(6, "Convite inválido"),
  nome: z.string().min(2, "Informe seu nome completo"),
  telefone: z.string().min(10, "Informe seu telefone com DDD"),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
  confirmacao: z.string(),
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

/**
 * Cria a conta a partir do convite e ja deixa o jogador logado — ele sai da
 * tela de cadastro direto para a tela inicial, sem precisar entrar de novo.
 */
export async function cadastrar(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<{ destino: string }>> {
  try {
    const bruto = esquema.safeParse({
      codigo: formulario.get("codigo"),
      nome: formulario.get("nome"),
      telefone: formulario.get("telefone"),
      senha: formulario.get("senha"),
      confirmacao: formulario.get("confirmacao"),
      posicao: formulario.get("posicao"),
      goleiro: formulario.get("goleiro") ?? undefined,
      peso: formulario.get("peso") ?? undefined,
      altura: formulario.get("altura") ?? undefined,
    });

    if (!bruto.success) {
      return falha("dados_invalidos", bruto.error.issues[0]?.message ?? "Confira os dados informados.");
    }

    const dados = bruto.data;
    if (dados.senha !== dados.confirmacao) {
      return falha("dados_invalidos", "As senhas não são iguais.");
    }

    const ehGoleiro = dados.goleiro === "on" || dados.posicao === "goleiro";

    await cadastrarComConvite({
      codigoConvite: dados.codigo,
      nome: dados.nome,
      telefone: dados.telefone,
      senha: dados.senha,
      posicao: dados.posicao,
      ehGoleiro,
      pesoKg: numeroOpcional(dados.peso),
      alturaCm: numeroOpcional(dados.altura),
    });

    // Login automatico logo apos o cadastro.
    const telefone = normalizarTelefone(dados.telefone)!;
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailDoTelefone(telefone, env().NEXT_PUBLIC_PHONE_EMAIL_DOMAIN),
      password: dados.senha,
    });

    if (error) {
      // A conta existe; so o login automatico falhou.
      return sucesso({ destino: "/entrar" });
    }

    return sucesso({ destino: "/inicio" });
  } catch (erro) {
    return comoResultado(erro);
  }
}
