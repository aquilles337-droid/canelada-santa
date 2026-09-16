import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessao do Supabase a cada navegacao (e o que mantem o jogador
 * logado depois de fechar o aplicativo) e barra o acesso as areas internas
 * de quem nao entrou.
 */

const ROTAS_PUBLICAS = ["/entrar", "/convite", "/offline", "/manifest.webmanifest"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));

  if (!data.user && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    // Volta para onde a pessoa queria ir depois do login.
    if (pathname !== "/") url.searchParams.set("destino", pathname);
    return NextResponse.redirect(url);
  }

  if (data.user && (pathname === "/entrar" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo menos arquivos estaticos, imagens, o service worker e as rotas de
     * API (que fazem a propria verificacao — webhook e cron nao tem sessao).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|sw.js|icons/|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)$).*)",
  ],
};
