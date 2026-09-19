"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { enviarFotoDaRodadaAction, removerFotoDaRodadaAction } from "@/server/actions/fotos";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EnvioDeFoto } from "@/components/ui/EnvioDeFoto";
import { useToast } from "@/components/ui/Toast";
import type { FotoComEndereco } from "@/server/services/fotos";

/**
 * Fotos da rodada.
 *
 * Só o administrador envia; todo mundo vê. A imagem sobe pelo servidor, que
 * confere tipo e tamanho antes de gravar qualquer coisa.
 */
export function FotosDaRodada({
  rodadaId,
  fotos,
  souAdmin,
}: {
  rodadaId: string;
  fotos: FotoComEndereco[];
  souAdmin: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [legenda, setLegenda] = useState("");
  const [removendo, iniciarRemocao] = useTransition();

  if (fotos.length === 0 && !souAdmin) return null;

  return (
    <Cartao>
      <CabecalhoCartao titulo="Fotos do racha" icone={<span aria-hidden>📸</span>} />

      {fotos.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {fotos.map((foto) => (
            <figure key={foto.id} className="relative overflow-hidden rounded-xl border border-linha">
              <Image
                src={foto.url}
                alt={foto.caption ?? "Foto do racha"}
                width={400}
                height={400}
                className="aspect-square w-full object-cover"
                unoptimized
              />

              {foto.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-carvao/85 px-2 py-1 text-[11px] text-osso/90 backdrop-blur-sm">
                  {foto.caption}
                </figcaption>
              )}

              {souAdmin && (
                <button
                  type="button"
                  disabled={removendo}
                  aria-label="Remover foto"
                  onClick={() =>
                    iniciarRemocao(async () => {
                      const resultado = await removerFotoDaRodadaAction(foto.id, rodadaId);
                      if (resultado.ok) {
                        toast.mostrar("Foto removida.", "aviso");
                        router.refresh();
                      } else {
                        toast.erro(resultado.mensagem);
                      }
                    })
                  }
                  className="absolute right-1.5 top-1.5 rounded-lg bg-carvao/85 px-2 py-1 text-xs text-vermelho backdrop-blur-sm"
                >
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {souAdmin && (
        <div className="flex flex-col gap-2">
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Legenda (opcional)"
            className="h-11 w-full rounded-xl border border-linha bg-carvao/80 px-4 text-sm text-osso placeholder:text-cinza-escuro focus:border-ouro/60 focus:outline-none"
          />
          <EnvioDeFoto
            acao={(formulario) => enviarFotoDaRodadaAction(null, formulario)}
            rotulo="Foto do racha"
            textoDoBotao="Publicar foto"
            camposExtras={{ rodadaId, legenda }}
            aoConcluir={() => {
              setLegenda("");
              router.refresh();
            }}
          />
        </div>
      )}
    </Cartao>
  );
}
