import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { montarEstadoDePresenca } from "@/server/services/presenca";
import { situacaoDaCota } from "@/server/services/convidados";
import { fotosDaRodada } from "@/server/services/fotos";
import { estadoDoJogo } from "@/server/services/partidas";
import { apuracaoDaRodada } from "@/server/services/votacao";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { BotoesDePresenca } from "@/components/rodada/BotoesDePresenca";
import { ListaDeJogadores } from "@/components/rodada/ListaDeJogadores";
import { PainelDeConvidados } from "@/components/rodada/PainelDeConvidados";
import { FotosDaRodada } from "@/components/rodada/FotosDaRodada";
import { Botao } from "@/components/ui/Botao";
import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { ErroDeRegra } from "@/lib/erros";
import { formatarDataHora, formatarDinheiro } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const { rodada } = await carregarRodada(id);
    return { title: nomeDaRodada(rodada) };
  } catch {
    return { title: "Racha" };
  }
}

export default async function PaginaDaRodada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await exigirUsuario();

  let dados;
  try {
    dados = await carregarRodada(id);
  } catch (erro) {
    if (erro instanceof ErroDeRegra && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  }

  const { rodada, participantes, convidados } = dados;
  const [estado, cota] = await Promise.all([
    montarEstadoDePresenca(id, perfil),
    situacaoDaCota(rodada, perfil),
  ]);

  const meusConvidados = convidados.filter((c) => c.host_profile_id === perfil.id);

  const confirmados = participantes.filter((p) => p.status === "confirmed" || p.status === "invited");
  const esperando = participantes.filter((p) => p.status === "waiting");
  const convidadosConfirmados = convidados.filter((c) => c.status !== "cancelled" && c.status !== "removed");

  const aceitaPresenca = rodada.status === "open" || rodada.status === "closed";
  const jaAconteceu = rodada.status === "finished";

  const [fotos, jogo, craque, bagre] = await Promise.all([
    fotosDaRodada(id),
    jaAconteceu ? estadoDoJogo(id) : Promise.resolve(null),
    jaAconteceu ? apuracaoDaRodada(id, "mvp") : Promise.resolve(null),
    jaAconteceu ? apuracaoDaRodada(id, "bagre") : Promise.resolve(null),
  ]);

  const eleitos = [
    { titulo: "Craque da rodada", emoji: "🏆", apuracao: craque },
    { titulo: "Bagre da rodada", emoji: "🥔", apuracao: bagre },
  ].filter((item) => item.apuracao?.vencedorId);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <CartaoDaRodada
        rodada={rodada}
        confirmados={confirmados.length}
        esperando={esperando.length}
        destaque
      >
        {aceitaPresenca && <BotoesDePresenca rodadaId={rodada.id} estado={estado} />}
      </CartaoDaRodada>

      {rodada.status === "open" && (
        <PainelDeConvidados rodadaId={rodada.id} meusConvidados={meusConvidados} cota={cota} />
      )}

      {jaAconteceu && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/racha/${rodada.id}/times`}>
            <Botao variante="escuro" larguraTotal>
              Times
            </Botao>
          </Link>
          <Link href={`/racha/${rodada.id}/votacao`}>
            <Botao variante="escuro" larguraTotal>
              Votação
            </Botao>
          </Link>
        </div>
      )}

      {eleitos.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {eleitos.map((item) => {
            const vencedor = item.apuracao?.contagem.find(
              (c) => c.profileId === item.apuracao?.vencedorId,
            );
            if (!vencedor) return null;

            return (
              <Cartao key={item.titulo} className="flex flex-col items-center gap-2 p-3 text-center">
                <span aria-hidden className="text-2xl">
                  {item.emoji}
                </span>
                <p className="text-[10px] uppercase tracking-wider text-cinza">{item.titulo}</p>
                <Avatar nome={vencedor.nome} fotoUrl={vencedor.fotoUrl} tamanho="md" />
                <p className="titulo-display w-full truncate text-sm">{vencedor.nome}</p>
                <Selo tom="neutro">{vencedor.votos} voto(s)</Selo>
              </Cartao>
            );
          })}
        </div>
      )}

      {jogo && jogo.partidas.filter((p) => p.status === "finished").length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Resultados" icone={<span aria-hidden>📋</span>} />
          <ul className="flex flex-col divide-y divide-linha">
            {jogo.partidas
              .filter((p) => p.status === "finished")
              .map((partida) => {
                const a = jogo.times.find((t) => t.id === partida.team_a_id);
                const b = jogo.times.find((t) => t.id === partida.team_b_id);

                return (
                  <li key={partida.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-6 text-xs text-cinza-escuro">#{partida.seq}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {a?.name} {partida.score_a} × {partida.score_b} {b?.name}
                    </span>
                    {partida.tiebreak && <Selo tom="ambar">Sorteio</Selo>}
                  </li>
                );
              })}
          </ul>
        </Cartao>
      )}

      <FotosDaRodada
        rodadaId={rodada.id}
        fotos={fotos}
        meuId={perfil.id}
        souAdmin={perfil.role === "admin"}
      />

      <Cartao>
        <CabecalhoCartao titulo="Detalhes" />
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Começa</dt>
            <dd className="text-right">{formatarDataHora(rodada.starts_at)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Local</dt>
            <dd className="text-right">{rodada.venue}</dd>
          </div>
          {rodada.address && (
            <div className="flex justify-between gap-3">
              <dt className="text-cinza">Endereço</dt>
              <dd className="text-right text-cinza">{rodada.address}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Lista fecha</dt>
            <dd className="text-right">{formatarDataHora(rodada.list_closes_at)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Formato</dt>
            <dd className="text-right">
              {rodada.teams_count} times · {rodada.match_minutes} min · {rodada.goals_to_win}{" "}
              {rodada.goals_to_win === 1 ? "gol" : "gols"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Avulso</dt>
            <dd className="text-right">{formatarDinheiro(rodada.pricing.casual_price_cents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Cancelar sem multa até</dt>
            <dd className="text-right">
              {rodada.cancel_deadline_hours}h antes
            </dd>
          </div>
        </dl>

        {rodada.rules && (
          <div className="mt-4 rounded-xl border border-linha bg-carvao/50 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-widest text-cinza">Regras deste racha</p>
            <p className="whitespace-pre-line text-sm text-osso/90">{rodada.rules}</p>
          </div>
        )}
      </Cartao>

      <Cartao>
        <CabecalhoCartao
          titulo={`Confirmados (${confirmados.length}/${rodada.capacity})`}
          icone={<span aria-hidden>✅</span>}
        />
        <ListaDeJogadores
          jogadores={confirmados.map((p) => ({ participacao: p, perfil: p.perfil }))}
          vazio={{ titulo: "Ninguém confirmado ainda", descricao: "Seja o primeiro a garantir a vaga." }}
        />
      </Cartao>

      {esperando.length > 0 && (
        <Cartao>
          <CabecalhoCartao
            titulo={`Lista de espera (${esperando.length})`}
            icone={<span aria-hidden>⏳</span>}
          />
          <ListaDeJogadores
            jogadores={esperando.map((p) => ({ participacao: p, perfil: p.perfil }))}
            vazio={{ titulo: "Ninguém esperando" }}
            mostrarHorario
          />
        </Cartao>
      )}

      {convidadosConfirmados.length > 0 && (
        <Cartao>
          <CabecalhoCartao
            titulo={`Convidados (${convidadosConfirmados.length})`}
            icone={<span aria-hidden>🎟️</span>}
          />
          <ul className="flex flex-col divide-y divide-linha">
            {convidadosConfirmados.map((convidado) => (
              <li key={convidado.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{convidado.name}</p>
                  <p className="text-[11px] text-cinza-escuro">
                    Convidado de {convidado.anfitriao.full_name}
                  </p>
                </div>
                <Selo tom={convidado.status === "confirmed" ? "verde" : "ambar"}>
                  {convidado.status === "confirmed" ? "Confirmado" : "Esperando"}
                </Selo>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
