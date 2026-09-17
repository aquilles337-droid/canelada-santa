"use client";

import { useEffect } from "react";

/**
 * Registra o service worker.
 *
 * É o que permite instalar o Canelada Santa na tela inicial, abrir sem
 * internet e receber notificações.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((erro) => {
        console.error("[canelada] não foi possível registrar o service worker", erro);
      });
    };

    // Espera a página terminar de carregar para não disputar banda com ela.
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
