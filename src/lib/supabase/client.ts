"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";

/**
 * Cliente do navegador. Usa apenas a chave publica e respeita o RLS.
 * Serve para leitura reativa e para o fluxo de sessao; toda escrita
 * relevante acontece em Server Actions no servidor.
 */
export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
