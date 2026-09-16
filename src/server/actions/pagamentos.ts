"use server";

import { revalidatePath } from "next/cache";
import { toDataURL } from "qrcode";
import { exigirUsuario } from "@/server/auth/sessao";
import { conferirPagamento, criarPagamentoPix, type PixParaPagar } from "@/server/payments/PaymentService";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

/** PIX pronto para a tela: com a imagem do QR Code ja montada. */
export interface PixExibivel extends PixParaPagar {
  /** Imagem pronta para usar em <img src>. */
  imagemQrCode: string | null;
}

/** Gera o PIX de uma cobranca do proprio jogador. */
export async function gerarPixAction(cobrancaId: string): Promise<Resultado<PixExibivel>> {
  try {
    const perfil = await exigirUsuario();
    const pix = await criarPagamentoPix(cobrancaId, perfil);

    // O Mercado Pago ja devolve a imagem pronta. Quando nao vier (provedor
    // simulado), desenhamos o QR aqui no servidor a partir do copia e cola.
    let imagemQrCode: string | null = pix.qrCodeBase64
      ? `data:image/png;base64,${pix.qrCodeBase64}`
      : null;

    if (!imagemQrCode && pix.copiaECola) {
      imagemQrCode = await toDataURL(pix.copiaECola, {
        width: 360,
        margin: 1,
        color: { dark: "#0a0a0a", light: "#f5f1e8" },
      });
    }

    return sucesso({ ...pix, imagemQrCode });
  } catch (erro) {
    return comoResultado(erro);
  }
}

/**
 * Botao "Já paguei".
 *
 * Nao confirma nada por conta propria: apenas pergunta ao provedor qual e a
 * situacao real do pagamento. Quem confirma continua sendo o backend.
 */
export async function conferirPagamentoAction(
  pagamentoId: string,
): Promise<Resultado<{ confirmado: boolean }>> {
  try {
    const perfil = await exigirUsuario();
    const confirmado = await conferirPagamento(pagamentoId, perfil);

    revalidatePath("/perfil/pagamentos");
    revalidatePath("/inicio");
    return sucesso({ confirmado });
  } catch (erro) {
    return comoResultado(erro);
  }
}
