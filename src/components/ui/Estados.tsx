import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Toda tela do Canelada Santa tem carregando, vazio e erro. Nada quebrado. */

export function Carregando({ texto = "Carregando", className }: { texto?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-cinza", className)}>
      <span aria-hidden className="size-8 rounded-full border-2 border-ouro/30 border-t-ouro animate-spin" />
      <p className="text-sm">{texto}…</p>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-elevado/70", className)} aria-hidden />;
}

export function EstadoVazio({
  icone = "⚽",
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 px-6 text-center", className)}>
      <span className="text-4xl opacity-60" aria-hidden>
        {icone}
      </span>
      <h3 className="titulo-display text-lg text-osso">{titulo}</h3>
      {descricao && <p className="text-sm text-cinza max-w-xs">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export function EstadoErro({
  titulo = "Algo deu errado",
  descricao = "Não conseguimos carregar agora. Tente de novo.",
  acao,
  className,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 px-6 text-center", className)}>
      <span className="text-4xl" aria-hidden>
        ⚠️
      </span>
      <h3 className="titulo-display text-lg text-osso">{titulo}</h3>
      <p className="text-sm text-cinza max-w-xs">{descricao}</p>
      {acao}
    </div>
  );
}
