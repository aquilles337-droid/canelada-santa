import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brasao oficial do Canelada Santa.
 *
 * A arte e usada exatamente como foi entregue pelo grupo — nao existe versao
 * redesenhada, simplificada ou recolorida. Qualquer modernizacao visual
 * acontece ao redor dele, nunca nele.
 */
export function Brasao({
  tamanho = 96,
  className,
  prioridade = false,
}: {
  tamanho?: number;
  className?: string;
  prioridade?: boolean;
}) {
  return (
    <Image
      src="/brand/brasao.jpg"
      alt="Canelada Santa"
      width={tamanho}
      height={tamanho}
      priority={prioridade}
      className={cn("select-none", className)}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}
