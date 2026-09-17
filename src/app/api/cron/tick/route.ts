import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rodarTarefasAgendadas } from "@/server/jobs";

/**
 * Tarefas agendadas.
 *
 * Chamado pelo cron do servidor, a cada minuto:
 *
 *   * * * * * curl -fsS -H "x-cron-secret: SEU_SEGREDO" https://seu-dominio/api/cron/tick
 *
 * A proteção é um segredo compartilhado comparado em tempo constante — sem
 * ele, qualquer um na internet poderia disparar promoção de fila e geração
 * de cobrança. Sem CRON_SECRET configurado, o endpoint recusa tudo: é
 * preferível o cron não rodar a rodar aberto para o mundo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(informado: string | null, esperado: string | undefined): boolean {
  if (!esperado || !informado) return false;

  const a = Buffer.from(informado, "utf8");
  const b = Buffer.from(esperado, "utf8");
  // Comprimentos diferentes nunca poderiam bater, e comparar direto evitaria
  // o timingSafeEqual lançar exceção.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

async function processar(request: Request) {
  const cfg = env();

  const cabecalho = request.headers.get("x-cron-secret");
  // Alguns painéis de hospedagem só deixam configurar Authorization.
  const autorizacao = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;

  if (!segredoConfere(cabecalho ?? autorizacao, cfg.CRON_SECRET)) {
    return NextResponse.json({ ok: false, motivo: "nao_autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const apenas = url.searchParams.get("jobs")?.split(",").filter(Boolean);

  const resultados = await rodarTarefasAgendadas(apenas);
  const houveFalha = resultados.some((r) => !r.ok);

  return NextResponse.json(
    {
      ok: !houveFalha,
      executadoEm: new Date().toISOString(),
      resultados,
    },
    // 500 quando algum job falhou, para o monitoramento do servidor perceber.
    { status: houveFalha ? 500 : 200 },
  );
}

export async function POST(request: Request) {
  return processar(request);
}

/** Alguns crons só fazem GET. */
export async function GET(request: Request) {
  return processar(request);
}
