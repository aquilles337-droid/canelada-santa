import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./tipos";

/**
 * Cliente com service role: ignora o RLS.
 *
 * Use SOMENTE depois de ter verificado sessao e permissao no servidor
 * (ver src/server/auth/sessao.ts). Nunca importe este modulo em codigo de
 * cliente — o `server-only` acima faz a compilacao falhar se isso acontecer.
 */
let cache: ReturnType<typeof createClient<Database>> | null = null;

export function clienteAdmin() {
  if (cache) return cache;

  const cfg = env();
  cache = createClient<Database>(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cache;
}
