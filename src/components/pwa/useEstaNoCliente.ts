"use client";

import { useSyncExternalStore } from "react";

const semInscricao = () => () => {};

/**
 * Diz se o componente já está rodando no navegador.
 *
 * Serve para o que depende do aparelho — plataforma, se já está instalado,
 * permissão de notificação. Nada disso existe no servidor, e renderizar um
 * palpite lá criaria diferença entre o que o servidor mandou e o que o
 * celular mostra.
 */
export function useEstaNoCliente(): boolean {
  return useSyncExternalStore(
    semInscricao,
    () => true,
    () => false,
  );
}
