"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const baseControle =
  "w-full rounded-xl bg-carvao/80 border border-linha px-4 text-osso placeholder:text-cinza-escuro " +
  "transition-colors focus:border-ouro/60 focus:outline-none disabled:opacity-50";

interface Envolucro {
  rotulo?: string;
  ajuda?: string;
  erro?: string | null;
  obrigatorio?: boolean;
  children: ReactNode;
  id: string;
  className?: string;
}

function Envolver({ rotulo, ajuda, erro, obrigatorio, children, id, className }: Envolucro) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rotulo && (
        <label htmlFor={id} className="text-xs uppercase tracking-widest text-cinza font-semibold">
          {rotulo}
          {obrigatorio && <span className="text-ouro"> *</span>}
        </label>
      )}
      {children}
      {erro ? (
        <p className="text-xs text-vermelho">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-cinza-escuro">{ajuda}</p>
      ) : null}
    </div>
  );
}

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo?: string;
  ajuda?: string;
  erro?: string | null;
  prefixo?: ReactNode;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, ajuda, erro, prefixo, className, required, id, ...props },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;

  return (
    <Envolver rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={required} id={idFinal} className={className}>
      <div className="relative">
        {prefixo && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cinza text-sm pointer-events-none">
            {prefixo}
          </span>
        )}
        <input
          ref={ref}
          id={idFinal}
          required={required}
          aria-invalid={erro ? true : undefined}
          className={cn(baseControle, "h-12", prefixo && "pl-12", erro && "border-vermelho/60")}
          {...props}
        />
      </div>
    </Envolver>
  );
});

export interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo?: string;
  ajuda?: string;
  erro?: string | null;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, ajuda, erro, className, required, id, children, ...props },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;

  return (
    <Envolver rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={required} id={idFinal} className={className}>
      <select
        ref={ref}
        id={idFinal}
        required={required}
        className={cn(baseControle, "h-12 appearance-none pr-10", erro && "border-vermelho/60")}
        {...props}
      >
        {children}
      </select>
    </Envolver>
  );
});

export interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo?: string;
  ajuda?: string;
  erro?: string | null;
}

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { rotulo, ajuda, erro, className, required, id, ...props },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;

  return (
    <Envolver rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={required} id={idFinal} className={className}>
      <textarea
        ref={ref}
        id={idFinal}
        required={required}
        rows={3}
        className={cn(baseControle, "py-3 resize-y min-h-24", erro && "border-vermelho/60")}
        {...props}
      />
    </Envolver>
  );
});
