"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarTimesAction } from "@/server/actions/times";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { CartaoDeTime } from "./CartaoDeTime";
import { CartaoDosGoleiros } from "./CartaoDosGoleiros";
import type { GoleiroDaRodada, TimeComIntegrantes } from "@/server/services/times";

/**
 * Controle do sorteio, no painel do administrador.
 *
 * "Gerar novamente" usa outra semente: o arranjo muda de verdade, sem
 * perder o equilíbrio.
 */
export function PainelDeTimes({
  rodadaId,
  times,
  goleiros,
  textoParaCompartilhar,
}: {
  rodadaId: string;
  times: TimeComIntegrantes[];
  goleiros: GoleiroDaRodada[];
  textoParaCompartilhar: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [gerando, iniciar] = useTransition();

  const gerar = () =>
    iniciar(async () => {
      const resultado = await gerarTimesAction(rodadaId);
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
      <Botao tamanho="lg" larguraTotal carregando={gerando} onClick={gerar}>
        {times.length > 0 ? "Gerar novamente" : "Gerar times"}
      </Botao>

      {times.length > 0 && (
        <>
          {/* O goleiro vem antes dos times porque ele não está em nenhum. */}
          <CartaoDosGoleiros goleiros={goleiros} />

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
