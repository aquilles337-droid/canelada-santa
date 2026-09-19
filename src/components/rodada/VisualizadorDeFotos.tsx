"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import type { FotoComEndereco } from "@/server/services/fotos";

/**
 * Foto aberta em tela cheia.
 *
 * Fecha no toque fora, no botão e no Escape. Setas do teclado e os botões
 * laterais passam entre as fotos, para dar para ver todas sem fechar e abrir
 * a cada uma.
 */
export function VisualizadorDeFotos({
  fotos,
  indice,
  aoFechar,
  aoTrocar,
}: {
  fotos: FotoComEndereco[];
  indice: number;
  aoFechar: () => void;
  aoTrocar: (novoIndice: number) => void;
}) {
  const foto = fotos[indice];

  const anterior = useCallback(() => {
    aoTrocar((indice - 1 + fotos.length) % fotos.length);
  }, [aoTrocar, indice, fotos.length]);

  const proxima = useCallback(() => {
    aoTrocar((indice + 1) % fotos.length);
  }, [aoTrocar, indice, fotos.length]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proxima();
    };

    window.addEventListener("keydown", aoTeclar);
    // Trava a rolagem da página atrás, senão o fundo desliza junto no celular.
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, [aoFechar, anterior, proxima]);

  if (!foto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={foto.caption ?? "Foto do racha"}
      className="fixed inset-0 z-100 flex flex-col bg-carvao/97 backdrop-blur-sm animate-subir"
      onClick={aoFechar}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <p className="text-xs text-cinza">
          {indice + 1} de {fotos.length}
        </p>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="grid size-9 place-items-center rounded-full border border-linha bg-elevado text-osso"
        >
          ✕
        </button>
      </div>

      {/* O clique na imagem não fecha: só o fundo ao redor. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <Image
          src={foto.url}
          alt={foto.caption ?? "Foto do racha"}
          width={1200}
          height={1200}
          className="max-h-full w-auto max-w-full rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
          unoptimized
          priority
        />

        {fotos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              className="absolute left-2 grid size-11 place-items-center rounded-full border border-linha bg-carvao/80 text-xl text-osso"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={(e) => {
                e.stopPropagation();
                proxima();
              }}
              className="absolute right-2 grid size-11 place-items-center rounded-full border border-linha bg-carvao/80 text-xl text-osso"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div
        className="px-5 py-4 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {foto.caption && <p className="text-sm text-osso/90">{foto.caption}</p>}
        {foto.autor && <p className="mt-1 text-xs text-cinza-escuro">Enviada por {foto.autor}</p>}
      </div>
    </div>
  );
}
