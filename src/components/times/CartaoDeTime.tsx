import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { formatarNota } from "@/lib/format";
import type { TimeComIntegrantes } from "@/server/services/times";
import { cn } from "@/lib/utils";

/** Cores de cada time no visual da casa. */
const ESTILOS: Record<string, { barra: string; texto: string; emoji: string }> = {
  ouro: { barra: "bg-time-1", texto: "text-time-1", emoji: "🟡" },
  azul: { barra: "bg-time-2", texto: "text-time-2", emoji: "🔵" },
  vermelho: { barra: "bg-time-3", texto: "text-time-3", emoji: "🔴" },
  branco: { barra: "bg-time-4", texto: "text-time-4", emoji: "⚪" },
  verde: { barra: "bg-time-5", texto: "text-time-5", emoji: "🟢" },
  roxo: { barra: "bg-time-6", texto: "text-time-6", emoji: "🟣" },
};

export function CartaoDeTime({
  time,
  mostrarNotas = false,
  className,
}: {
  time: TimeComIntegrantes;
  mostrarNotas?: boolean;
  className?: string;
}) {
  const estilo = ESTILOS[time.color] ?? ESTILOS.ouro!;

  return (
    <Cartao className={cn("relative overflow-hidden p-0", className)}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", estilo.barra)} />

      <div className="flex items-center justify-between gap-3 border-b border-linha px-4 py-3 pl-5">
        <h3 className={cn("titulo-display text-lg", estilo.texto)}>
          <span aria-hidden className="mr-1.5">
            {estilo.emoji}
          </span>
          {time.name}
        </h3>
        {mostrarNotas && (
          <Selo tom="neutro">{formatarNota(Number(time.rating_total))} pts</Selo>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-linha/60 px-4 py-1 pl-5">
        {time.integrantes.map((integrante) => (
          <li key={integrante.id} className="flex items-center gap-2.5 py-2">
            <span aria-hidden className="text-sm">
              {integrante.ehGoleiro ? "🧤" : "⚽"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {integrante.nome}
              {integrante.ehConvidado && (
                <span className="ml-1.5 text-[11px] text-cinza-escuro">convidado</span>
              )}
            </span>
            {mostrarNotas && (
              <span className="text-xs tabular-nums text-cinza">
                {formatarNota(Number(integrante.rating_snapshot))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
