"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarTimesAction } from "@/server/actions/times";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { CartaoDeTime } from "./CartaoDeTime";
import type { TimeComIntegrantes } from "@/server/services/times";

/**
 * Controle do sorteio, no painel do administrador.
 *
 * "Gerar novamente" usa outra semente: o arranjo muda de verdade, sem
 * perder o equilíbrio.
 */
export function PainelDeTimes({
  rodadaId,
  times,
  textoParaCompartilhar,
}: {
  rodadaId: string;
  times: TimeComIntegrantes[];
  textoParaCompartilhar: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [gerando, iniciar] = useTransition();
  const [goleiroExtra, setGoleiroExtra] = useState<"linha" | "fora">("linha");

  const gerar = () =>
    iniciar(async () => {
      const resultado = await gerarTimesAction(rodadaId, goleiroExtra);
      if (resultado.ok) {
        toast.sucesso("Times sorteados!");
        router.refresh();
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  const linkDoWhatsapp = `https://wa.me/?text=${encodeURIComponent(textoParaCompartilhar)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={goleiroExtra === "fora"}
            onChange={(e) => setGoleiroExtra(e.target.checked ? "fora" : "linha")}
            className="size-5 accent-[#c9a227]"
          />
          <span>
            Goleiro que sobrar fica de fora
            <span className="block text-xs text-cinza-escuro">
              Desmarcado, o goleiro extra entra na linha.
            </span>
          </span>
        </label>

        <Botao tamanho="lg" larguraTotal carregando={gerando} onClick={gerar}>
          {times.length > 0 ? "Gerar novamente" : "Gerar times"}
        </Botao>
      </div>

      {times.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {times.map((time) => (
              <CartaoDeTime key={time.id} time={time} mostrarNotas />
            ))}
          </div>

          <a href={linkDoWhatsapp} target="_blank" rel="noopener noreferrer" className="block">
            <Botao variante="sucesso" larguraTotal tamanho="lg">
              Compartilhar no WhatsApp
            </Botao>
          </a>
        </>
      )}
    </div>
  );
}
