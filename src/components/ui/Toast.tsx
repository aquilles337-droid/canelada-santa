"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tom = "sucesso" | "erro" | "aviso" | "info";

interface Aviso {
  id: number;
  tom: Tom;
  texto: string;
}

interface ContextoToast {
  mostrar: (texto: string, tom?: Tom) => void;
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
}

const Contexto = createContext<ContextoToast | null>(null);

const estilos: Record<Tom, string> = {
  sucesso: "border-verde/40 bg-verde/10 text-verde",
  erro: "border-vermelho/40 bg-vermelho/10 text-vermelho",
  aviso: "border-ambar/40 bg-ambar/10 text-ambar",
  info: "border-ouro/40 bg-ouro/10 text-ouro-claro",
};

const icones: Record<Tom, string> = { sucesso: "✓", erro: "✕", aviso: "!", info: "i" };

export function ProvedorDeToast({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const mostrar = useCallback((texto: string, tom: Tom = "info") => {
    const id = Date.now() + Math.random();
    setAvisos((atual) => [...atual, { id, tom, texto }]);
    setTimeout(() => setAvisos((atual) => atual.filter((a) => a.id !== id)), 4200);
  }, []);

  const valor = useMemo<ContextoToast>(
    () => ({
      mostrar,
      sucesso: (texto: string) => mostrar(texto, "sucesso"),
      erro: (texto: string) => mostrar(texto, "erro"),
    }),
    [mostrar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        className="fixed inset-x-0 top-0 z-100 flex flex-col items-center gap-2 p-3 pointer-events-none"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        role="status"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            className={cn(
              "animate-subir w-full max-w-sm rounded-xl border px-4 py-3",
              "backdrop-blur-md shadow-fundo flex items-start gap-2.5 text-sm",
              estilos[aviso.tom],
            )}
          >
            <span aria-hidden className="font-bold mt-px">
              {icones[aviso.tom]}
            </span>
            <span className="text-osso/95">{aviso.texto}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast(): ContextoToast {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useToast precisa estar dentro de ProvedorDeToast");
  return contexto;
}
