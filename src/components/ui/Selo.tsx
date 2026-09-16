import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tom = "ouro" | "verde" | "vermelho" | "ambar" | "neutro" | "azul";

const tons: Record<Tom, string> = {
  ouro: "bg-ouro/15 text-ouro-claro border-ouro/35",
  verde: "bg-verde/15 text-verde border-verde/35",
  vermelho: "bg-vermelho/15 text-vermelho border-vermelho/35",
  ambar: "bg-ambar/15 text-ambar border-ambar/35",
  azul: "bg-azul/15 text-azul border-azul/35",
  neutro: "bg-elevado text-cinza border-linha",
};

export function Selo({
  children,
  tom = "neutro",
  className,
}: {
  children: ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-bold uppercase tracking-wider whitespace-nowrap",
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
