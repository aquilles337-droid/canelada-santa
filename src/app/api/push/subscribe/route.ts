import { NextResponse } from "next/server";
import { z } from "zod";
import { clienteAdmin } from "@/lib/supabase/admin";
import { usuarioAtual } from "@/server/auth/sessao";

/**
 * Inscrição em notificações (Web Push).
 *
 * O navegador gera a inscrição e manda para cá. Guardamos o endereço e as
 * chaves em `push_subscriptions`, sempre amarrados ao jogador logado — o
 * corpo da requisição nunca diz de quem é a inscrição.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esquema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const perfil = await usuarioAtual();
  if (!perfil) {
    return NextResponse.json({ ok: false, motivo: "nao_autenticado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "corpo_invalido" }, { status: 400 });
  }

  const dados = esquema.safeParse(corpo);
  if (!dados.success) {
    return NextResponse.json({ ok: false, motivo: "inscricao_invalida" }, { status: 400 });
  }

  // Se a mesma inscrição já existe (mesmo celular), ela é reaproveitada e
  // apenas reassociada ao jogador logado.
  const { error } = await clienteAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: perfil.id,
        endpoint: dados.data.endpoint,
        p256dh: dados.data.keys.p256dh,
        auth: dados.data.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        enabled: true,
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("[canelada] falha ao salvar inscrição de push", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Desligar as notificações neste aparelho. */
export async function DELETE(request: Request) {
  const perfil = await usuarioAtual();
  if (!perfil) {
    return NextResponse.json({ ok: false, motivo: "nao_autenticado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "corpo_invalido" }, { status: 400 });
  }

  const endpoint = (corpo as { endpoint?: string }).endpoint;
  if (!endpoint) {
    return NextResponse.json({ ok: false, motivo: "endpoint_ausente" }, { status: 400 });
  }

  // O filtro por profile_id impede alguém apagar a inscrição de outra pessoa.
  await clienteAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", perfil.id);

  return NextResponse.json({ ok: true });
}
