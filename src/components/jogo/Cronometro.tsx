"use client";

import { useEffect, useState } from "react";
import { formatarCronometro } from "@/lib/format";
import { segundosRestantes } from "@/domain/partida";
import { cn } from "@/lib/utils";

/**
 * Cronômetro da partida.
 *
 * O tempo é sempre derivado do horário de início gravado no banco, nunca de
 * um contador em memória: fechar e reabrir o aplicativo no meio da partida
 * mostra o tempo certo. O intervalo só empurra o "agora" para frente.
 */
export function Cronometro({
  comecouEm,
  duracaoEmMinutos,
  rodando,
  className,
}: {
  comecouEm: string | null;
  duracaoEmMinutos: number;
  rodando: boolean;
  className?: string;
}) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!rodando || !comecouEm) return;

    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [rodando, comecouEm]);

  const restante = segundosRestantes(
    comecouEm ? new Date(comecouEm) : null,
    duracaoEmMinutos,
    new Date(agora),
  );

  const acabando = restante <= 60 && restante > 0;
  const acabou = restante === 0 && rodando;

  return (
    <div className={cn("text-center", className)}>
      {/* O relógio do servidor e o do celular não batem no milissegundo;
          a diferença aparece só no primeiro quadro e se corrige sozinha. */}
      <p
        suppressHydrationWarning
        className={cn(
          "titulo-display text-6xl tabular-nums leading-none transition-colors",
          acabou ? "text-vermelho" : acabando ? "text-ambar" : "text-osso",
        )}
        aria-live="polite"
      >
        {formatarCronometro(restante)}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-cinza">
        {acabou ? "Tempo esgotado" : rodando ? "Em jogo" : "Aguardando início"}
      </p>
    </div>
  );
}
