"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarValorDasMensalidadesAction } from "@/server/actions/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { useToast } from "@/components/ui/Toast";
import { formatarDinheiro, plural } from "@/lib/format";

/**
 * Aviso de valor desatualizado.
 *
 * A mensalidade guarda o valor de quando foi gerada — é o que mantém o
 * histórico honesto. Mas quando o grupo muda o valor e a cobrança do mês
 * ainda está em aberto, o certo é cobrar o valor novo. Este aviso só aparece
 * quando existe essa diferença.
 */
export function AvisoDeValor({
  desatualizadas,
  valorAtualCentavos,
}: {
  desatualizadas: number;
  valorAtualCentavos: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [atualizando, iniciar] = useTransition();

  if (desatualizadas === 0) return null;

  return (
    <Cartao className="border-ambar/40">
      <p className="text-sm">
        <span aria-hidden className="mr-1.5">
          ⚠️
        </span>
        {plural(desatualizadas, "mensalidade em aberto está", "mensalidades em aberto estão")} com
        valor diferente do configurado hoje ({formatarDinheiro(valorAtualCentavos)}).
      </p>

      <p className="mt-1 text-xs text-cinza-escuro">
        Atualizar troca o valor só de quem ainda não pagou. Quem já pagou ou foi perdoado não é
        tocado, e o PIX antigo daquelas cobranças é cancelado para não valer o valor velho.
      </p>

      <Botao
        className="mt-3"
        larguraTotal
        carregando={atualizando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await atualizarValorDasMensalidadesAction();
            if (resultado.ok) {
              toast.sucesso(
                `${plural(resultado.dados.atualizadas, "mensalidade atualizada", "mensalidades atualizadas")} para ${formatarDinheiro(resultado.dados.valorCentavos)}.`,
              );
              router.refresh();
            } else {
              toast.erro(resultado.mensagem);
            }
          })
        }
      >
        Atualizar para {formatarDinheiro(valorAtualCentavos)}
      </Botao>
    </Cartao>
  );
}
