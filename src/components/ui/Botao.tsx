import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variante = "ouro" | "escuro" | "contorno" | "fantasma" | "perigo" | "sucesso";
type Tamanho = "sm" | "md" | "lg" | "xl";

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  larguraTotal?: boolean;
}

const variantes: Record<Variante, string> = {
  ouro:
    "bg-linear-to-b from-ouro-claro to-ouro text-carvao font-bold shadow-[0_8px_24px_-8px_rgba(201,162,39,0.6)] " +
    "hover:from-ouro hover:to-ouro-escuro active:scale-[0.98]",
  escuro:
    "bg-elevado text-osso border border-linha hover:border-ouro/40 hover:bg-grafite active:scale-[0.98]",
  contorno:
    "bg-transparent text-ouro border border-ouro/50 hover:bg-ouro/10 active:scale-[0.98]",
  fantasma: "bg-transparent text-cinza hover:text-osso hover:bg-elevado/60",
  perigo: "bg-vermelho/15 text-vermelho border border-vermelho/40 hover:bg-vermelho/25 active:scale-[0.98]",
  sucesso: "bg-verde/15 text-verde border border-verde/40 hover:bg-verde/25 active:scale-[0.98]",
};

// Alvos de toque grandes: o aplicativo e usado em pe, na quadra, com uma mao.
const tamanhos: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-13 px-5 text-base gap-2",
  xl: "h-16 px-6 text-lg gap-2.5",
};

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { className, variante = "ouro", tamanho = "md", carregando = false, larguraTotal = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={cn(
        "inline-flex items-center justify-center rounded-xl transition-all duration-150",
        "uppercase tracking-wide font-semibold select-none",
        "disabled:opacity-45 disabled:pointer-events-none",
        variantes[variante],
        tamanhos[tamanho],
        larguraTotal && "w-full",
        className,
      )}
      {...props}
    >
      {carregando ? (
        <>
          <span
            aria-hidden
            className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
          <span>Aguarde</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
