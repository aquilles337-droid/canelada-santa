import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./tipos";

/**
 * Cliente do servidor ligado a sessao do usuario, sujeito ao RLS.
 * A sessao fica em cookie httpOnly: o jogador continua logado depois de
 * fechar e abrir o aplicativo.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();
  const cfg = env();

  return createServerClient<Database>(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components nao podem escrever cookies. A renovacao da
          // sessao acontece no middleware, entao ignorar aqui e seguro.
        }
      },
    },
  });
}
