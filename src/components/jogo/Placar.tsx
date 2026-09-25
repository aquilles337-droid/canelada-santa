import { cn } from "@/lib/utils";

const CORES: Record<string, string> = {
  ouro: "text-time-1",
  azul: "text-time-2",
  vermelho: "text-time-3",
  branco: "text-time-4",
  verde: "text-time-5",
  roxo: "text-time-6",
};

/**
 * Placar grande, legível de longe — dá para conferir da linha de fundo.
 *
 * O goleiro aparece embaixo do nome do time, e não dentro dele: ele é do
 * GOL. Quando a linha sai, ele continua ali — e é por isso que a vitória
 * dele é contada pelo lado que defendeu.
 */
export function Placar({
  timeA,
  timeB,
  golsA,
  golsB,
  goleiroA,
  goleiroB,
  className,
}: {
  timeA: { name: string; color: string };
  timeB: { name: string; color: string };
  golsA: number;
  golsB: number;
  goleiroA?: string | null;
  goleiroB?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1 text-center">
        <p className={cn("titulo-display truncate text-sm", CORES[timeA.color] ?? "text-osso")}>
          {timeA.name}
        </p>
        <p className="titulo-display text-5xl tabular-nums leading-none">{golsA}</p>
        <p className="mt-1 truncate text-[11px] text-cinza-escuro">
          {goleiroA ? `🧤 ${goleiroA}` : "🧤 sem goleiro fixo"}
        </p>
      </div>

      <span aria-hidden className="titulo-display pt-5 text-2xl text-cinza-escuro">
        ×
      </span>

      <div className="min-w-0 flex-1 text-center">
        <p className={cn("titulo-display truncate text-sm", CORES[timeB.color] ?? "text-osso")}>
          {timeB.name}
        </p>
        <p className="titulo-display text-5xl tabular-nums leading-none">{golsB}</p>
        <p className="mt-1 truncate text-[11px] text-cinza-escuro">
          {goleiroB ? `🧤 ${goleiroB}` : "🧤 sem goleiro fixo"}
        </p>
      </div>
    </div>
  );
}
