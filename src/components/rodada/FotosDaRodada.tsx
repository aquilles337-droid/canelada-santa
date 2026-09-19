"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { enviarFotoDaRodadaAction, removerFotoDaRodadaAction } from "@/server/actions/fotos";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EnvioDeFoto } from "@/components/ui/EnvioDeFoto";
import { EstadoVazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import type { FotoComEndereco } from "@/server/services/fotos";
import { VisualizadorDeFotos } from "./VisualizadorDeFotos";

/**
 * Álbum do racha.
 *
 * Qualquer jogador do grupo publica — as fotos boas costumam estar no
 * celular de quem jogou, não no de quem administra. Apagar continua sendo só
 * de quem publicou, ou de um administrador.
 */
export function FotosDaRodada({
  rodadaId,
  fotos,
  meuId,
  souAdmin,
}: {
  rodadaId: string;
  fotos: FotoComEndereco[];
  meuId: string;
  souAdmin: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [legenda, setLegenda] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [removendo, iniciarRemocao] = useTransition();

  const posso = (foto: FotoComEndereco) => foto.uploaded_by === meuId || souAdmin;

  return (
    <Cartao>
      <CabecalhoCartao
        titulo={fotos.length > 0 ? `Fotos do racha (${fotos.length})` : "Fotos do racha"}
        icone={<span aria-hidden>📸</span>}
      />

      {fotos.length === 0 ? (
        <EstadoVazio
          icone="📸"
          titulo="Nenhuma foto ainda"
          descricao="Tirou foto no racha? Manda aqui que todo mundo vê."
        />
      ) : (
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {fotos.map((foto, indice) => (
            <div key={foto.id} className="group relative">
              <button
                type="button"
                onClick={() => setAberta(indice)}
                aria-label={foto.caption ?? `Abrir foto ${indice + 1}`}
                className="block w-full overflow-hidden rounded-lg border border-linha transition-colors hover:border-ouro/50"
              >
                <Image
                  src={foto.url}
                  alt={foto.caption ?? "Foto do racha"}
                  width={300}
                  height={300}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              </button>

              {posso(foto) && (
                <button
                  type="button"
                  disabled={removendo}
                  aria-label="Apagar foto"
                  onClick={() =>
                    iniciarRemocao(async () => {
                      const resultado = await removerFotoDaRodadaAction(foto.id, rodadaId);
                      if (resultado.ok) {
                        toast.mostrar("Foto apagada.", "aviso");
                        router.refresh();
                      } else {
                        toast.erro(resultado.mensagem);
                      }
                    })
                  }
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-md bg-carvao/85 text-xs text-vermelho backdrop-blur-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Legenda (opcional)"
          className="h-11 w-full rounded-xl border border-linha bg-carvao/80 px-4 text-sm text-osso placeholder:text-cinza-escuro focus:border-ouro/60 focus:outline-none"
        />
        <EnvioDeFoto
          acao={(formulario) => enviarFotoDaRodadaAction(null, formulario)}
          rotulo="Mandar foto do racha"
          textoDoBotao="Publicar foto"
          camposExtras={{ rodadaId, legenda }}
          aoConcluir={() => {
            setLegenda("");
            router.refresh();
          }}
        />
      </div>

      {aberta !== null && (
        <VisualizadorDeFotos
          fotos={fotos}
          indice={aberta}
          aoFechar={() => setAberta(null)}
          aoTrocar={setAberta}
        />
      )}
    </Cartao>
  );
}
