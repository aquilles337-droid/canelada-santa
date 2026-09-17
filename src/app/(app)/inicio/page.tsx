import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/sessao";
import { carregarRodada, proximaRodada } from "@/server/services/rodadas";
import { montarEstadoDePresenca } from "@/server/services/presenca";
import { cobrancasEmAberto } from "@/server/services/cobrancas";
import { estatisticasDoJogador, montarRanking } from "@/server/services/estatisticas";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { BotoesDePresenca } from "@/components/rodada/BotoesDePresenca";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { Brasao } from "@/components/brand/Brasao";
import { ConviteParaInstalar } from "@/components/pwa/ConviteParaInstalar";
import { ResumoFinanceiro } from "@/components/financeiro/CartaoDePagamento";
import { Selo } from "@/components/ui/Selo";
import { formatarPercentual, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Início" };

export default async function PaginaInicio() {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");

  const [proxima, emAberto, minhas, ranking] = await Promise.all([
    proximaRodada(),
    cobrancasEmAberto(perfil.id),
    estatisticasDoJogador(perfil.id),
    montarRanking("presencas"),
  ]);

  const totalEmAberto = emAberto.reduce((soma, c) => soma + c.amount_cents, 0);
  const minhaPosicao = ranking.findIndex((l) => l.profileId === perfil.id) + 1;

  const meusNumeros = (
    <div className="grid grid-cols-2 gap-3">
      <Cartao className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-cinza">Sua sequência</p>
        <p className="titulo-display mt-1 text-3xl">
          <span aria-hidden>🔥</span> {minhas.sequenciaAtual}
        </p>
        <p className="text-[11px] text-cinza-escuro">
          {plural(minhas.sequenciaAtual, "racha seguido", "rachas seguidos")}
        </p>
      </Cartao>

      <Cartao className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-cinza">Seu ranking</p>
        <p className="titulo-display mt-1 text-3xl texto-ouro">
          {minhaPosicao > 0 ? `#${minhaPosicao}` : "—"}
        </p>
        <p className="text-[11px] text-cinza-escuro">
          {minhas.presencas > 0
            ? `${formatarPercentual(minhas.assiduidade)} de presença`
            : "Jogue seu primeiro racha"}
        </p>
      </Cartao>
    </div>
  );

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

        <ResumoFinanceiro totalEmAbertoCentavos={totalEmAberto} />

      {meusNumeros}

      <ConviteParaInstalar />
        {meusNumeros}
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
        {perfil.is_member ? <Selo tom="ouro">Mensalista</Selo> : <Selo tom="neutro">Avulso</Selo>}
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

      <ResumoFinanceiro totalEmAbertoCentavos={totalEmAberto} />

      {meusNumeros}

      <ConviteParaInstalar />
    </div>
  );
}
