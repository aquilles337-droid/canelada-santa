import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/sessao";
import { Cabecalho } from "@/components/nav/Cabecalho";
import { NavegacaoInferior } from "@/components/nav/NavegacaoInferior";

export default async function LayoutAplicativo({ children }: { children: React.ReactNode }) {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");

  return (
    <div className="min-h-dvh">
      <Cabecalho perfil={perfil} />
      <main className="mx-auto max-w-lg px-4 pt-4 pb-24">{children}</main>
      {/* Administrador tambem e jogador: navega pelo aplicativo normal e ganha
          apenas um atalho a mais para o painel. */}
      <NavegacaoInferior variante={perfil.role === "admin" ? "jogador-admin" : "jogador"} />
    </div>
  );
}
