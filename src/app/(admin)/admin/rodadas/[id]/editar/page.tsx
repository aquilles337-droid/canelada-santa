import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { ErroDeRegra } from "@/lib/erros";
import { paraCamposLocais } from "@/lib/fuso";
import { Cartao } from "@/components/ui/Cartao";
import { FormularioEditarRodada } from "./FormularioEditarRodada";

export const metadata: Metadata = { title: "Editar racha" };

export default async function PaginaEditarRodada({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // Racha encerrado ou cancelado nao se edita — o serviço recusa, e a tela
  // nem oferece o formulario para a pessoa perder tempo preenchendo.
  if (rodada.status === "finished" || rodada.status === "cancelled") {
    return (
      <div className="flex flex-col gap-4 animate-subir">
        <h1 className="titulo-display text-xl">{nomeDaRodada(rodada)}</h1>
        <Cartao>
          <p className="text-sm text-cinza">
            {rodada.status === "finished"
              ? "Este racha já foi encerrado. O histórico dele não muda mais — é o que mantém o ranking e o Hall da Fama confiáveis."
              : "Este racha foi cancelado e não pode mais ser alterado."}
          </p>
        </Cartao>
      </div>
    );
  }

  const inicio = paraCamposLocais(rodada.starts_at);
  const fechamento = paraCamposLocais(rodada.list_closes_at);

  const vagasOcupadas = participantes.filter(
    (p) => p.status === "confirmed" || p.status === "invited",
  ).length;
  const naEspera = participantes.filter((p) => p.status === "waiting").length;

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <header>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">Editar</p>
        <h1 className="titulo-display text-xl">{nomeDaRodada(rodada)}</h1>
      </header>

      <FormularioEditarRodada
        valores={{
          id: rodada.id,
          titulo: rodada.title ?? "",
          data: inicio.data,
          hora: inicio.hora,
          local: rodada.venue,
          endereco: rodada.address ?? "",
          vagas: String(rodada.capacity),
          times: String(rodada.teams_count),
          jogadoresPorTime: rodada.players_per_team ? String(rodada.players_per_team) : "",
          minutos: String(rodada.match_minutes),
          gols: String(rodada.goals_to_win),
          fechamentoData: fechamento.data,
          fechamentoHora: fechamento.hora,
          regras: rodada.rules ?? "",
          vagasOcupadas,
          naEspera,
        }}
      />
    </div>
  );
}
