import Link from "next/link";
import { Selo } from "@/components/ui/Selo";
import { diaDaSemanaCurto, formatarData, formatarHora, tempoAte } from "@/lib/format";
import type { Round, RoundStatus } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

const SITUACAO: Record<RoundStatus, { texto: string; tom: "ouro" | "verde" | "vermelho" | "ambar" | "neutro" | "azul" }> = {
  draft: { texto: "Rascunho", tom: "neutro" },
  open: { texto: "Lista aberta", tom: "verde" },
  closed: { texto: "Lista fechada", tom: "ambar" },
  in_progress: { texto: "Rolando agora", tom: "ouro" },
  finished: { texto: "Encerrado", tom: "neutro" },
  cancelled: { texto: "Cancelado", tom: "vermelho" },
};

export function nomeDaRodada(rodada: Pick<Round, "title" | "number">): string {
  return rodada.title?.trim() || `Canelada Santa #${rodada.number}`;
}

/**
 * Cartao principal do racha: data grande, local e ocupacao, no formato que
 * o grupo le de relance antes de decidir se vai.
 */
export function CartaoDaRodada({
  rodada,
  confirmados,
  esperando = 0,
  href,
  destaque = false,
  children,
}: {
  rodada: Round;
  confirmados: number;
  esperando?: number;
  href?: string;
  destaque?: boolean;
  children?: React.ReactNode;
}) {
  const situacao = SITUACAO[rodada.status];
  const comeca = new Date(rodada.starts_at);
  const ocupacao = Math.min(100, Math.round((confirmados / rodada.capacity) * 100));
  const lotado = confirmados >= rodada.capacity;

  const corpo = (
    <div
      className={cn(
        "superficie relative overflow-hidden p-4",
        destaque && "border-ouro/35 shadow-ouro",
      )}
    >
      <span aria-hidden className="faixa-diagonal pointer-events-none absolute inset-y-0 right-0 w-24 opacity-50" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cinza">{nomeDaRodada(rodada)}</p>
          <p className="titulo-display mt-1 text-3xl leading-none">
            {diaDaSemanaCurto(comeca)}
            <span className="texto-ouro"> {formatarHora(comeca)}</span>
          </p>
          <p className="mt-1.5 text-sm text-cinza">
            {formatarData(comeca)} · 📍 {rodada.venue}
          </p>
        </div>
        <Selo tom={situacao.tom}>{situacao.texto}</Selo>
      </div>

      <div className="relative mt-4">
        <div className="flex items-end justify-between gap-2">
          <p className="titulo-display text-xl">
            {confirmados}
            <span className="text-cinza">/{rodada.capacity}</span>
            <span className="ml-1.5 text-xs font-normal uppercase tracking-wider text-cinza">
              confirmados
            </span>
          </p>
          {esperando > 0 && (
            <p className="text-xs text-cinza">
              {esperando} na espera
            </p>
          )}
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevado">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              lotado ? "bg-vermelho" : "bg-linear-to-r from-ouro-escuro via-ouro to-ouro-claro",
            )}
            style={{ width: `${ocupacao}%` }}
          />
        </div>

        {rodada.status === "open" && (
          <p className="mt-2 text-xs text-cinza-escuro">
            Lista fecha {tempoAte(rodada.list_closes_at)}
          </p>
        )}
      </div>

      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );

  if (!href) return corpo;

  return (
    <Link href={href} className="block transition-transform active:scale-[0.99]">
      {corpo}
    </Link>
  );
}
