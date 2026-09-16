"use server";

import { revalidatePath } from "next/cache";
import { toDataURL } from "qrcode";
import { exigirAdmin } from "@/server/auth/sessao";
import { criarConvite, listarConvites, revogarConvite } from "@/server/services/convites";
import { env } from "@/lib/env";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";
import type { Invitation } from "@/lib/supabase/tipos";

/** Convite pronto para o administrador compartilhar: codigo, link e QR Code. */
export interface ConvitePronto {
  convite: Invitation;
  link: string;
  qrCode: string;
}

export async function criarConviteAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<ConvitePronto>> {
  try {
    const admin = await exigirAdmin();

    const maxUsos = Number(formulario.get("maxUsos") ?? 1);
    const validade = Number(formulario.get("validoPorDias") ?? 0);
    const nota = String(formulario.get("nota") ?? "").trim() || null;

    const convite = await criarConvite({
      criadoPor: admin.id,
      maxUsos: Number.isFinite(maxUsos) ? maxUsos : 1,
      validoPorDias: Number.isFinite(validade) && validade > 0 ? validade : null,
      nota,
    });

    const link = `${env().NEXT_PUBLIC_APP_URL}/convite/${convite.code}`;
    // O QR Code sai pronto do servidor: a tela so precisa exibir.
    const qrCode = await toDataURL(link, {
      width: 320,
      margin: 1,
      color: { dark: "#0a0a0a", light: "#f5f1e8" },
    });

    revalidatePath("/admin/jogadores");
    return sucesso({ convite, link, qrCode });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function revogarConviteAction(conviteId: string): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await revogarConvite(conviteId, admin.id);
    revalidatePath("/admin/jogadores");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function listarConvitesAction(): Promise<Resultado<Invitation[]>> {
  try {
    await exigirAdmin();
    return sucesso(await listarConvites());
  } catch (erro) {
    return comoResultado(erro);
  }
}
