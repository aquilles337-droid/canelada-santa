import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { goleirosDaRodada, textoParaWhatsapp, timesDaRodada } from "@/server/services/times";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Avatar } from "@/components/ui/Avatar";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { ErroDeRegra } from "@/lib/erros";
import { formatarHora } from "@/lib/format";
import { PainelDeTimes } from "@/components/times/PainelDeTimes";
import Link from "next/link";
import { Botao } from "@/components/ui/Botao";
import { AcoesDaRodada } from "./AcoesDaRodada";
import { RemoverJogador } from "./RemoverJogador";

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

export default async function PaginaAdminRodada({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;

  let dados;
  try {
    dados = await carregarRodada(id);
  } catch (erro) {
    if (erro instanceof ErroDeRegra && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  }

  const { rodada, participantes } = dados;
  const [times, goleiros] = await Promise.all([timesDaRodada(id), goleirosDaRodada(id)]);
  const confirmados = participantes.filter((p) => p.status === "confirmed");
  const chamados = participantes.filter((p) => p.status === "invited");
  const esperando = participantes.filter((p) => p.status === "waiting");
  const foraDaLista = participantes.filter((p) =>
    ["cancelled", "declined", "removed"].includes(p.status),
  );

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <CartaoDaRodada
        rodada={rodada}
        confirmados={confirmados.length + chamados.length}
        esperando={esperando.length}
        destaque
      >
        <AcoesDaRodada rodadaId={rodada.id} situacao={rodada.status} />
      </CartaoDaRodada>

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/admin/rodadas/${rodada.id}/editar`}>
          <Botao variante="escuro" larguraTotal>
            Editar racha
          </Botao>
        </Link>
        <Link href={`/admin/rodadas/${rodada.id}/jogo`}>
          <Botao variante="escuro" larguraTotal>
            Modo jogo
          </Botao>
        </Link>
        <Link href={`/admin/rodadas/${rodada.id}/presenca`}>
          <Botao variante="escuro" larguraTotal>
            Presença
          </Botao>
        </Link>
        <Link href={`/racha/${rodada.id}/times`}>
          <Botao variante="escuro" larguraTotal>
            Ver times
          </Botao>
        </Link>
        <Link href={`/racha/${rodada.id}/votacao`}>
          <Botao variante="escuro" larguraTotal>
            Votação
          </Botao>
        </Link>
      </div>

      <Cartao>
        <CabecalhoCartao titulo="Times" icone={<span aria-hidden>🎽</span>} />
        <PainelDeTimes
          rodadaId={rodada.id}
          times={times}
          goleiros={goleiros}
          textoParaCompartilhar={textoParaWhatsapp(nomeDaRodada(rodada), times, goleiros)}
        />
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo={`Confirmados (${confirmados.length}/${rodada.capacity})`} />
        {confirmados.length === 0 ? (
          <EstadoVazio icone="⚽" titulo="Ninguém confirmado ainda" />
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {confirmados.map((p, indice) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right text-xs font-bold text-cinza-escuro tabular-nums">
                  {indice + 1}
                </span>
                <Avatar nome={p.perfil.full_name} fotoUrl={p.perfil.photo_url} tamanho="sm" goleiro={p.perfil.is_goalkeeper} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.perfil.full_name}</p>
                  <p className="text-[11px] text-cinza-escuro">Entrou às {formatarHora(p.joined_at)}</p>
                </div>
                {p.kind === "monthly" ? <Selo tom="ouro">Mensalista</Selo> : <Selo tom="neutro">Avulso</Selo>}
                <RemoverJogador rodadaId={rodada.id} participacaoId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {chamados.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Chamados da fila (${chamados.length})`} icone={<span aria-hidden>📣</span>} />
          <ul className="flex flex-col divide-y divide-linha">
            {chamados.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar nome={p.perfil.full_name} fotoUrl={p.perfil.photo_url} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.perfil.full_name}</p>
                  {p.invite_expires_at && (
                    <p className="text-[11px] text-ambar">
                      Responde até {formatarHora(p.invite_expires_at)}
                    </p>
                  )}
                </div>
                <Selo tom="ambar">Aguardando</Selo>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao titulo={`Lista de espera (${esperando.length})`} icone={<span aria-hidden>⏳</span>} />
        {esperando.length === 0 ? (
          <EstadoVazio icone="⏳" titulo="Ninguém na espera" />
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {esperando.map((p, indice) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right text-xs font-bold text-cinza-escuro tabular-nums">
                  {indice + 1}
                </span>
                <Avatar nome={p.perfil.full_name} fotoUrl={p.perfil.photo_url} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.perfil.full_name}</p>
                  <p className="text-[11px] text-cinza-escuro">Entrou às {formatarHora(p.joined_at)}</p>
                </div>
                {p.kind === "monthly" ? <Selo tom="ouro">Mensalista</Selo> : <Selo tom="neutro">Avulso</Selo>}
                <RemoverJogador rodadaId={rodada.id} participacaoId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {foraDaLista.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Saíram da lista (${foraDaLista.length})`} />
          <ul className="flex flex-col divide-y divide-linha">
            {foraDaLista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 opacity-70">
                <Avatar nome={p.perfil.full_name} fotoUrl={p.perfil.photo_url} tamanho="xs" />
                <p className="min-w-0 flex-1 truncate text-sm">{p.perfil.full_name}</p>
                {p.cancel_was_late ? (
                  <Selo tom="vermelho">Saiu em cima da hora</Selo>
                ) : (
                  <Selo tom="neutro">Saiu</Selo>
                )}
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
