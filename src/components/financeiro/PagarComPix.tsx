"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conferirPagamentoAction, gerarPixAction, type PixExibivel } from "@/server/actions/pagamentos";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { formatarDinheiro, formatarHora } from "@/lib/format";

/**
 * Pagamento por PIX.
 *
 * O botao "Já paguei" NAO confirma nada: ele apenas pede ao sistema para
 * perguntar ao provedor qual e a situacao real. Quem confirma o pagamento e
 * sempre o backend, pelo webhook. Voltar para esta tela nunca quita nada.
 */
export function PagarComPix({ cobrancaId }: { cobrancaId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pix, setPix] = useState<PixExibivel | null>(null);
  const [gerando, iniciarGeracao] = useTransition();
  const [conferindo, iniciarConferencia] = useTransition();

  const gerar = () =>
    iniciarGeracao(async () => {
      const resultado = await gerarPixAction(cobrancaId);
      if (resultado.ok) setPix(resultado.dados);
      else toast.erro(resultado.mensagem);
    });

  const copiar = async () => {
    if (!pix?.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      toast.sucesso("Código copiado. Cole no aplicativo do seu banco.");
    } catch {
      toast.erro("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  const conferir = () =>
    iniciarConferencia(async () => {
      if (!pix) return;
      const resultado = await conferirPagamentoAction(pix.pagamentoId);

      if (!resultado.ok) {
        toast.erro(resultado.mensagem);
        return;
      }

      if (resultado.dados.confirmado) {
        toast.sucesso("Pagamento confirmado! ✅");
        router.refresh();
      } else {
        toast.mostrar(
          "Ainda não caiu. Assim que o banco confirmar, atualizamos aqui e te avisamos.",
          "aviso",
        );
      }
    });

  if (!pix) {
    return (
      <Botao className="mt-3" larguraTotal carregando={gerando} onClick={gerar}>
        Pagar com PIX
      </Botao>
    );
  }

  return (
    <div className="mt-3 flex w-full flex-col items-center gap-3 border-t border-linha pt-4 animate-subir">
      {pix.imagemQrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pix.imagemQrCode} alt="QR Code do PIX" className="size-52 rounded-xl" />
      )}

      <p className="titulo-display text-2xl texto-ouro">{formatarDinheiro(pix.valorCentavos)}</p>

      {pix.copiaECola && (
        <p className="w-full break-all rounded-xl border border-linha bg-carvao/70 p-3 text-center text-[11px] text-cinza">
          {pix.copiaECola}
        </p>
      )}

      <div className="grid w-full grid-cols-2 gap-2">
        <Botao variante="ouro" onClick={copiar}>
          Copiar código
        </Botao>
        <Botao variante="escuro" carregando={conferindo} onClick={conferir}>
          Já paguei
        </Botao>
      </div>

      {pix.expiraEm && (
        <p className="text-xs text-cinza-escuro">
          Este código vale até {formatarHora(pix.expiraEm)}.
        </p>
      )}

      <p className="text-center text-xs text-cinza-escuro">
        A confirmação é automática. Assim que o banco avisar, sua pendência some daqui.
      </p>
    </div>
  );
}
