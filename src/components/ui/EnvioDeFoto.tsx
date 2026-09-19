"use client";

import { useRef, useState, useTransition } from "react";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { reduzirImagem, tamanhoLegivel } from "@/lib/imagem";

/**
 * Envio de foto.
 *
 * A imagem é reduzida no próprio aparelho antes de subir — foto de celular
 * tem vários megabytes e no aplicativo aparece pequena. Quem está na quadra,
 * no 4G, sente a diferença.
 *
 * O servidor continua conferindo tipo e tamanho: a redução aqui é conforto,
 * não segurança.
 */
export function EnvioDeFoto({
  acao,
  rotulo,
  textoDoBotao,
  camposExtras,
  larguraMaxima,
  aoConcluir,
}: {
  acao: (formulario: FormData) => Promise<{ ok: boolean; mensagem?: string }>;
  rotulo: string;
  textoDoBotao: string;
  camposExtras?: Record<string, string>;
  larguraMaxima?: number;
  aoConcluir?: () => void;
}) {
  const toast = useToast();
  const campo = useRef<HTMLInputElement>(null);
  const [escolhida, setEscolhida] = useState<{ arquivo: File; original: number } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) {
      setEscolhida(null);
      return;
    }

    setPreparando(true);
    try {
      const reduzida = await reduzirImagem(arquivo, { larguraMaxima });
      setEscolhida({ arquivo: reduzida, original: arquivo.size });
    } finally {
      setPreparando(false);
    }
  };

  const enviar = () =>
    iniciarEnvio(async () => {
      if (!escolhida) return;

      const formulario = new FormData();
      formulario.set("foto", escolhida.arquivo, escolhida.arquivo.name);
      for (const [chave, valor] of Object.entries(camposExtras ?? {})) {
        formulario.set(chave, valor);
      }

      const resultado = await acao(formulario);

      if (resultado.ok) {
        toast.sucesso("Foto enviada.");
        setEscolhida(null);
        if (campo.current) campo.current.value = "";
        aoConcluir?.();
      } else {
        toast.erro(resultado.mensagem ?? "Não foi possível enviar a foto.");
      }
    });

  const encolheu = escolhida && escolhida.arquivo.size < escolhida.original;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-cinza">{rotulo}</p>

      <input
        ref={campo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void escolher(e.target.files?.[0])}
        className="w-full rounded-xl border border-linha bg-carvao/70 px-3 py-2.5 text-sm text-cinza file:mr-3 file:rounded-lg file:border-0 file:bg-elevado file:px-3 file:py-1.5 file:text-xs file:text-osso"
      />

      {preparando && <p className="text-xs text-cinza">Preparando a imagem…</p>}

      {escolhida && !preparando && (
        <p className="text-xs text-cinza-escuro">
          {encolheu ? (
            <>
              Reduzida de {tamanhoLegivel(escolhida.original)} para{" "}
              <span className="text-verde">{tamanhoLegivel(escolhida.arquivo.size)}</span>
            </>
          ) : (
            <>Tamanho: {tamanhoLegivel(escolhida.arquivo.size)}</>
          )}
        </p>
      )}

      <Botao
        type="button"
        variante="escuro"
        larguraTotal
        disabled={!escolhida || preparando}
        carregando={enviando}
        onClick={enviar}
      >
        {textoDoBotao}
      </Botao>
    </div>
  );
}
