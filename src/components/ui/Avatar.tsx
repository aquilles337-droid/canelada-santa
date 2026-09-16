import Image from "next/image";
import { iniciais } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tamanho = "xs" | "sm" | "md" | "lg" | "xl";

const tamanhos: Record<Tamanho, { caixa: string; texto: string; px: number }> = {
  xs: { caixa: "size-7", texto: "text-[10px]", px: 28 },
  sm: { caixa: "size-9", texto: "text-xs", px: 36 },
  md: { caixa: "size-11", texto: "text-sm", px: 44 },
  lg: { caixa: "size-16", texto: "text-lg", px: 64 },
  xl: { caixa: "size-24", texto: "text-2xl", px: 96 },
};

export function Avatar({
  nome,
  fotoUrl,
  tamanho = "md",
  goleiro = false,
  className,
}: {
  nome: string;
  fotoUrl?: string | null;
  tamanho?: Tamanho;
  goleiro?: boolean;
  className?: string;
}) {
  const t = tamanhos[tamanho];

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden grid place-items-center",
          "bg-linear-to-br from-elevado to-carvao border border-linha",
          t.caixa,
        )}
      >
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={nome}
            width={t.px}
            height={t.px}
            className="size-full object-cover"
          />
        ) : (
          <span className={cn("font-bold text-cinza", t.texto)} aria-hidden>
            {iniciais(nome)}
          </span>
        )}
      </div>
      {goleiro && (
        <span
          className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none bg-carvao rounded-full p-0.5 border border-linha"
          title="Goleiro"
        >
          🧤
        </span>
      )}
    </div>
  );
}
