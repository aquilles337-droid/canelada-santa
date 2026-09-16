import { cn } from "@/lib/utils";

const CORES: Record<string, string> = {
  ouro: "text-time-1",
  azul: "text-time-2",
  vermelho: "text-time-3",
  branco: "text-time-4",
  verde: "text-time-5",
  roxo: "text-time-6",
};

/** Placar grande, legível de longe — dá para conferir da linha de fundo. */
export function Placar({
  timeA,
  timeB,
  golsA,
  golsB,
  className,
}: {
  timeA: { name: string; color: string };
  timeB: { name: string; color: string };
  golsA: number;
  golsB: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0 flex-1 text-center">
        <p className={cn("titulo-display truncate text-sm", CORES[timeA.color] ?? "text-osso")}>
          {timeA.name}
        </p>
        <p className="titulo-display text-5xl tabular-nums leading-none">{golsA}</p>
      </div>

      <span aria-hidden className="titulo-display text-2xl text-cinza-escuro">
        ×
      </span>

      <div className="min-w-0 flex-1 text-center">
        <p className={cn("titulo-display truncate text-sm", CORES[timeB.color] ?? "text-osso")}>
          {timeB.name}
        </p>
        <p className="titulo-display text-5xl tabular-nums leading-none">{golsB}</p>
      </div>
    </div>
  );
}
