"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { enviarFotoDaRodadaAction, removerFotoDaRodadaAction } from "@/server/actions/fotos";
import { Botao } from "@/components/ui/Botao";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
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
  const campoRef = useRef<HTMLInputElement>(null);
  const [removendo, iniciarRemocao] = useTransition();
  const [estado, acao, enviando] = useActionState(enviarFotoDaRodadaAction, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.sucesso("Foto publicada.");
      if (campoRef.current) campoRef.current.value = "";
      router.refresh();
    } else {
      toast.erro(estado.mensagem);
    }
  }, [estado, router, toast]);

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
        <form action={acao} className="flex flex-col gap-2">
          <input type="hidden" name="rodadaId" value={rodadaId} />
          <input
            ref={campoRef}
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            required
            className="w-full rounded-xl border border-linha bg-carvao/70 px-3 py-2.5 text-sm text-cinza file:mr-3 file:rounded-lg file:border-0 file:bg-elevado file:px-3 file:py-1.5 file:text-xs file:text-osso"
          />
          <input
            name="legenda"
            placeholder="Legenda (opcional)"
            className="h-11 w-full rounded-xl border border-linha bg-carvao/80 px-4 text-sm text-osso placeholder:text-cinza-escuro focus:border-ouro/60 focus:outline-none"
          />
          <Botao type="submit" larguraTotal carregando={enviando}>
            Publicar foto
          </Botao>
        </form>
      )}
    </Cartao>
  );
}
