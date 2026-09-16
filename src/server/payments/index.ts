import "server-only";

import { env } from "@/lib/env";
import { MercadoPagoProvider } from "./MercadoPagoProvider";
import { ProvedorSimulado } from "./ProvedorSimulado";
import type { ProvedorDePagamento } from "./tipos";

/**
 * Escolhe o provedor conforme PAYMENT_PROVIDER.
 *
 * "mercadopago" exige token real (validado em src/lib/env.ts). "mock" usa o
 * provedor simulado, que permite testar o fluxo inteiro sem credencial.
 */
let cache: ProvedorDePagamento | null = null;

export function provedorDePagamento(): ProvedorDePagamento {
  if (cache) return cache;

  const cfg = env();
  cache =
    cfg.PAYMENT_PROVIDER === "mercadopago"
      ? new MercadoPagoProvider(cfg.MP_ACCESS_TOKEN!)
      : new ProvedorSimulado();

  return cache;
}

/** Usado apenas nos testes. */
export function limparCacheDoProvedor(): void {
  cache = null;
}

export type { ProvedorDePagamento } from "./tipos";
