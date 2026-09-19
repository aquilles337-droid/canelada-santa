import { redirect } from "next/navigation";
import Link from "next/link";
import { usuarioAtual } from "@/server/auth/sessao";
import { Brasao } from "@/components/brand/Brasao";
import { NavegacaoInferior } from "@/components/nav/NavegacaoInferior";
import { Selo } from "@/components/ui/Selo";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");
  if (perfil.role !== "admin" || perfil.status !== "active") redirect("/inicio");

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-40 border-b border-linha bg-carvao/92 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="relative mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
          <span aria-hidden className="faixa-diagonal absolute inset-y-0 right-0 w-24 opacity-40" />
          <Brasao tamanho={38} />
          <span className="titulo-display text-base leading-none">
            Painel<span className="texto-ouro"> Admin</span>
          </span>
          <Link href="/inicio" className="relative z-10 ml-auto">
            <Selo tom="neutro">Ver como jogador</Selo>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 pb-24">{children}</main>
      <NavegacaoInferior variante="admin" />
    </div>
  );
}
