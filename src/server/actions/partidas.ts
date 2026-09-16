"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import {
  abrirPrimeiraPartida,
  ajustarPlacar,
  desfazerGol,
  encerrarPartida,
  iniciarCronometro,
  registrarGol,
  type GolRegistrado,
} from "@/server/services/partidas";
import { comoResultado, sucesso, type Resultado } from "@/lib/erros";

function atualizar(rodadaId: string): void {
  revalidatePath(`/admin/rodadas/${rodadaId}/jogo`);
  revalidatePath(`/racha/${rodadaId}`);
  revalidatePath(`/racha/${rodadaId}/jogo`);
}

export async function abrirJogoAction(rodadaId: string): Promise<Resultado<{ partidaId: string }>> {
  try {
    const admin = await exigirAdmin();
    const partida = await abrirPrimeiraPartida(rodadaId, admin.id);

    atualizar(rodadaId);
    return sucesso({ partidaId: partida.id });
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function iniciarCronometroAction(
  rodadaId: string,
  partidaId: string,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    await iniciarCronometro(partidaId);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function registrarGolAction(
  rodadaId: string,
  gol: GolRegistrado,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    await registrarGol(gol, admin.id);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function desfazerGolAction(rodadaId: string, eventoId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await desfazerGol(eventoId);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function ajustarPlacarAction(
  rodadaId: string,
  partidaId: string,
  golsA: number,
  golsB: number,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    await ajustarPlacar(partidaId, golsA, golsB);

    atualizar(rodadaId);
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function encerrarPartidaAction(
  rodadaId: string,
  partidaId: string,
): Promise<Resultado<{ explicacao: string; houveSorteio: boolean }>> {
  try {
    const admin = await exigirAdmin();
    const fim = await encerrarPartida(partidaId, admin.id);

    atualizar(rodadaId);
    return sucesso({ explicacao: fim.explicacao, houveSorteio: fim.sorteio !== null });
  } catch (erro) {
    return comoResultado(erro);
  }
}
