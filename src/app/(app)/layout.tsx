import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/sessao";
import { Cabecalho } from "@/components/nav/Cabecalho";
import { NavegacaoInferior, NAV_JOGADOR, type ItemNavegacao } from "@/components/nav/NavegacaoInferior";
import { IconeEngrenagem } from "@/components/nav/Icones";

export default async function LayoutAplicativo({ children }: { children: React.ReactNode }) {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");

  // Administrador tambem e jogador: ele navega pelo aplicativo normal e
  // ganha apenas um atalho a mais para o painel.
  const itens: ItemNavegacao[] =
    perfil.role === "admin"
      ? [...NAV_JOGADOR, { href: "/admin", rotulo: "Admin", Icone: IconeEngrenagem }]
      : NAV_JOGADOR;

  return (
    <div className="min-h-dvh">
      <Cabecalho perfil={perfil} />
      <main className="mx-auto max-w-lg px-4 pt-4 pb-24">{children}</main>
      <NavegacaoInferior itens={itens} />
    </div>
  );
}
