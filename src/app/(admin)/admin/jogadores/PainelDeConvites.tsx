"use client";

import { useActionState, useEffect } from "react";
import { criarConviteAction } from "@/server/actions/convites";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { useToast } from "@/components/ui/Toast";

/**
 * Geracao de convite. O administrador recebe link, codigo e QR Code do
 * mesmo convite e escolhe como mandar — os tres levam ao mesmo cadastro.
 */
export function PainelDeConvites() {
  const toast = useToast();
  const [estado, acao, enviando] = useActionState(criarConviteAction, null);

  const pronto = estado?.ok ? estado.dados : null;

  useEffect(() => {
    if (estado && !estado.ok) toast.erro(estado.mensagem);
  }, [estado, toast]);

  const copiar = async (texto: string, rotulo: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.sucesso(`${rotulo} copiado.`);
    } catch {
      toast.erro("Não foi possível copiar. Copie manualmente.");
    }
  };

  return (
    <Cartao>
      <CabecalhoCartao titulo="Convidar jogador" />

      <form action={acao} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo name="maxUsos" rotulo="Usos" type="number" min={1} max={100} defaultValue={1} />
          <Campo
            name="validoPorDias"
            rotulo="Validade"
            type="number"
            min={0}
            defaultValue={7}
            ajuda="Dias (0 = sem prazo)"
          />
        </div>
        <Campo name="nota" rotulo="Observação" placeholder="Ex.: primo do Léo" />
        <Botao type="submit" larguraTotal carregando={enviando}>
          Gerar convite
        </Botao>
      </form>

      {pronto && (
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-linha pt-4 animate-subir">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pronto.qrCode}
            alt={`QR Code do convite ${pronto.convite.code}`}
            className="size-44 rounded-xl"
          />

          <p className="titulo-display text-2xl tracking-[0.3em] texto-ouro">{pronto.convite.code}</p>

          <div className="grid w-full grid-cols-2 gap-2">
            <Botao variante="escuro" tamanho="sm" onClick={() => copiar(pronto.convite.code, "Código")}>
              Copiar código
            </Botao>
            <Botao variante="escuro" tamanho="sm" onClick={() => copiar(pronto.link, "Link")}>
              Copiar link
            </Botao>
          </div>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `⚽ Você foi convidado para o CANELADA SANTA!\n\nEntre por aqui: ${pronto.link}\n\nOu use o código: ${pronto.convite.code}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Botao variante="ouro" larguraTotal>
              Enviar no WhatsApp
            </Botao>
          </a>
        </div>
      )}
    </Cartao>
  );
}
