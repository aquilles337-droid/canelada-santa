import "server-only";

import { z } from "zod";

/**
 * Variaveis de ambiente do servidor. Sao validadas na primeira leitura, para
 * o sistema falhar na subida com uma mensagem clara em vez de quebrar no meio
 * de um pagamento.
 *
 * Nenhum segredo daqui pode vazar para o navegador. O `server-only` acima
 * faz a compilacao falhar se alguem importar este modulo de um componente
 * de cliente — a garantia nao depende de ninguem lembrar da regra.
 */
const esquemaServidor = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY ausente"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_PHONE_EMAIL_DOMAIN: z.string().min(3).default("telefone.canelada.app"),

  PAYMENT_PROVIDER: z.enum(["mercadopago", "mock"]).default("mock"),
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_PIX_EXPIRATION_MINUTES: z.coerce.number().int().positive().default(30),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:contato@caneladasanta.app"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),

  CRON_SECRET: z.string().min(16, "CRON_SECRET precisa ter ao menos 16 caracteres").optional(),
});

export type EnvServidor = z.infer<typeof esquemaServidor>;

let cache: EnvServidor | null = null;

export function env(): EnvServidor {
  if (cache) return cache;

  const resultado = esquemaServidor.safeParse(process.env);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `Configuracao invalida. Verifique o arquivo .env (use o .env.example como base):\n${problemas}`,
    );
  }

  // O Mercado Pago so pode ser escolhido com credencial presente; caso
  // contrario o sistema aceitaria pagamentos que nunca seriam confirmados.
  if (resultado.data.PAYMENT_PROVIDER === "mercadopago" && !resultado.data.MP_ACCESS_TOKEN) {
    throw new Error("PAYMENT_PROVIDER=mercadopago exige MP_ACCESS_TOKEN definido no .env");
  }

  cache = resultado.data;
  return cache;
}

/** Limpa o cache — usado apenas nos testes. */
export function limparCacheEnv(): void {
  cache = null;
}
