import type { NextConfig } from "next";

/**
 * Domínios autorizados a enviar formulários para o servidor.
 *
 * O Next.js compara o domínio de quem enviou o formulário com o domínio que
 * recebeu a requisição. Atrás de um proxy — que é o caso da Hostinger — os
 * dois chegam diferentes, e o envio é recusado antes de o código rodar:
 * o navegador mostra "This page couldn't load" e nenhum erro aparece na tela.
 *
 * Aqui liberamos o domínio configurado em NEXT_PUBLIC_APP_URL, mais o
 * endereço temporário da Hostinger e o desenvolvimento local.
 */
function dominiosAutorizados(): string[] {
  const lista = ["localhost:3000", "*.hostingersite.com"];

  const configurado = process.env.NEXT_PUBLIC_APP_URL;
  if (configurado) {
    try {
      lista.push(new URL(configurado).host);
    } catch {
      // Endereço malformado no .env: seguimos com os padrões.
    }
  }

  return [...new Set(lista)];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: dominiosAutorizados(),
      // O padrao do Next e 1 MB, e qualquer foto de celular passa disso —
      // o envio era recusado antes mesmo de a validacao do servidor rodar.
      // O navegador ja reduz a imagem (ver src/lib/imagem.ts); este limite e
      // a rede de seguranca, acima do maior tamanho que o servidor aceita.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
