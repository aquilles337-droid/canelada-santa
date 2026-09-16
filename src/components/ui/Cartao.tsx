import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CartaoProps extends HTMLAttributes<HTMLDivElement> {
  destaque?: boolean;
  children: ReactNode;
}

/** Superficie padrao do aplicativo: fundo profundo, fio fino, sombra densa. */
export function Cartao({ className, destaque = false, children, ...props }: CartaoProps) {
  return (
    <div
      className={cn(
        "superficie p-4",
        destaque && "border-ouro/35 shadow-ouro",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CabecalhoCartao({
  titulo,
  acao,
  icone,
  className,
}: {
  titulo: string;
  acao?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <h2 className="titulo-display text-sm text-cinza flex items-center gap-2">
        {icone}
        {titulo}
      </h2>
      {acao}
    </div>
  );
}
