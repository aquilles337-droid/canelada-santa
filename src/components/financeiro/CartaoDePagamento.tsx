import Link from "next/link";
import { Selo } from "@/components/ui/Selo";
import { formatarData, formatarDinheiro } from "@/lib/format";
import type { Charge, ChargeStatus, ChargeType } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

const ICONE: Record<ChargeType, string> = {
  monthly: "📅",
  match: "⚽",
  guest: "🎟️",
  fine: "⚠️",
};

const SITUACAO: Record<ChargeStatus, { texto: string; tom: "verde" | "ambar" | "vermelho" | "neutro" }> = {
  pending: { texto: "Em aberto", tom: "ambar" },
  paid: { texto: "Pago", tom: "verde" },
  expired: { texto: "Vencido", tom: "vermelho" },
  cancelled: { texto: "Cancelado", tom: "neutro" },
  waived: { texto: "Perdoado", tom: "neutro" },
};

/** Uma linha do extrato do jogador. */
export function CartaoDePagamento({
  cobranca,
  acao,
  className,
}: {
  cobranca: Charge;
  acao?: React.ReactNode;
  className?: string;
}) {
  const situacao = SITUACAO[cobranca.status];
  const emAberto = cobranca.status === "pending" || cobranca.status === "expired";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-linha bg-carvao/50 p-3",
        cobranca.status === "expired" && "border-vermelho/30",
        className,
      )}
    >
      <span aria-hidden className="text-xl">
        {ICONE[cobranca.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{cobranca.description}</p>
        <p className="text-[11px] text-cinza-escuro">
          {cobranca.due_date ? `Vence em ${formatarData(cobranca.due_date)}` : formatarData(cobranca.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className={cn("titulo-display text-base", emAberto ? "text-osso" : "text-cinza")}>
          {formatarDinheiro(cobranca.amount_cents)}
        </p>
        <Selo tom={situacao.tom}>{situacao.texto}</Selo>
      </div>

      {acao}
    </div>
  );
}

/** Resumo grande que abre a aba de pagamentos. */
export function ResumoFinanceiro({ totalEmAbertoCentavos }: { totalEmAbertoCentavos: number }) {
  const emDia = totalEmAbertoCentavos === 0;

  return (
    <Link href="/perfil/pagamentos" className="block">
      <div
        className={cn(
          "superficie flex items-center gap-4 p-4",
          emDia ? "border-verde/30" : "border-vermelho/35",
        )}
      >
        <span aria-hidden className="text-3xl">
          {emDia ? "🟢" : "🔴"}
        </span>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cinza">Pagamentos</p>
          <p className="titulo-display text-xl">
            {emDia ? "Tudo em dia" : formatarDinheiro(totalEmAbertoCentavos)}
          </p>
          {!emDia && <p className="text-xs text-cinza">Quite para entrar no próximo racha.</p>}
        </div>
        <span aria-hidden className="text-ouro">
          →
        </span>
      </div>
    </Link>
  );
}
