import { usuarioAtual } from "@/server/auth/sessao";
import { Brasao } from "@/components/brand/Brasao";

export default async function PaginaInicio() {
  const perfil = await usuarioAtual();

  return (
    <main className="px-4 py-6 flex flex-col items-center gap-4">
      <Brasao tamanho={120} prioridade />
      <h1 className="titulo-display text-2xl">Olá, {perfil?.full_name ?? "jogador"}</h1>
    </main>
  );
}
