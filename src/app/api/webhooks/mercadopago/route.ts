import { NextResponse } from "next/server";
import { processarNotificacao } from "@/server/payments/PaymentService";

/**
 * Webhook do Mercado Pago.
 *
 * Este endpoint e publico por natureza — quem garante a autenticidade e a
 * assinatura HMAC conferida dentro do provedor, nao a rota.
 *
 * A resposta e sempre 200 quando o evento foi recebido e registrado, mesmo
 * que nada tenha mudado: se respondessemos erro, o Mercado Pago reenviaria
 * o mesmo evento indefinidamente. Assinatura invalida responde 401.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let corpo: unknown;

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ recebido: false, motivo: "corpo_invalido" }, { status: 400 });
  }

  try {
    const resultado = await processarNotificacao(corpo, request.headers);

    if (!resultado.aceita) {
      return NextResponse.json({ recebido: false, motivo: resultado.motivo }, { status: 401 });
    }

    return NextResponse.json({ recebido: true, motivo: resultado.motivo }, { status: 200 });
  } catch (erro) {
    console.error("[canelada] erro inesperado no webhook do Mercado Pago", erro);
    // Devolver 500 faz o Mercado Pago tentar de novo, que e o desejado
    // quando a falha foi nossa.
    return NextResponse.json({ recebido: false }, { status: 500 });
  }
}

/** O Mercado Pago faz uma checagem simples da URL ao configurar o webhook. */
export async function GET() {
  return NextResponse.json({ servico: "canelada-santa", webhook: "mercadopago" });
}
