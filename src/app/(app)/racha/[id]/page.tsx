import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { montarEstadoDePresenca } from "@/server/services/presenca";
import { situacaoDaCota } from "@/server/services/convidados";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { BotoesDePresenca } from "@/components/rodada/BotoesDePresenca";
import { ListaDeJogadores } from "@/components/rodada/ListaDeJogadores";
import { PainelDeConvidados } from "@/components/rodada/PainelDeConvidados";
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
