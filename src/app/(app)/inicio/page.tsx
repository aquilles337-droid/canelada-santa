import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/sessao";
import { carregarRodada, proximaRodada } from "@/server/services/rodadas";
import { montarEstadoDePresenca } from "@/server/services/presenca";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { BotoesDePresenca } from "@/components/rodada/BotoesDePresenca";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { Brasao } from "@/components/brand/Brasao";

export const metadata: Metadata = { title: "Início" };

export default async function PaginaInicio() {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");

  const proxima = await proximaRodada();

  if (!proxima) {
    return (
      <div className="flex flex-col gap-4 animate-subir">
        <Cartao destaque className="flex flex-col items-center gap-3 py-8 text-center">
          <Brasao tamanho={110} prioridade />
          <h1 className="titulo-display text-2xl">
            Olá, <span className="texto-ouro">{perfil.full_name.split(" ")[0]}</span>
          </h1>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Próximo racha" />
          <EstadoVazio
            icone="📅"
            titulo="Nenhum racha marcado"
            descricao="Quando a próxima rodada abrir, ela aparece aqui e você recebe um aviso."
          />
        </Cartao>
      </div>
    );
  }

  const [{ participantes }, estado] = await Promise.all([
    carregarRodada(proxima.id),
    montarEstadoDePresenca(proxima.id, perfil),
  ]);

  const confirmados = participantes.filter((p) => p.status === "confirmed" || p.status === "invited").length;
  const esperando = participantes.filter((p) => p.status === "waiting").length;
  const aceitaPresenca = proxima.status === "open" || proxima.status === "closed";

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="titulo-display text-xl">
          Olá, <span className="texto-ouro">{perfil.full_name.split(" ")[0]}</span>
        </h1>
      </div>

      <CartaoDaRodada rodada={proxima} confirmados={confirmados} esperando={esperando} destaque>
        {aceitaPresenca && <BotoesDePresenca rodadaId={proxima.id} estado={estado} />}
      </CartaoDaRodada>

      <Link href={`/racha/${proxima.id}`} className="block">
        <Cartao className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm text-cinza">Ver lista completa e detalhes</span>
          <span aria-hidden className="text-ouro">
            →
          </span>
        </Cartao>
      </Link>
    </div>
  );
}
