import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { calcularMulta } from "@/domain/presenca";
import { rodadaParaDominio } from "@/server/services/rodadas";
import { EstadoVazio } from "@/components/ui/Estados";
import { ControleDePresenca } from "./ControleDePresenca";

export const metadata: Metadata = { title: "Controle de presença" };

export default async function PaginaControleDePresenca({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;

  const { rodada, participantes } = await carregarRodada(id);
  const confirmados = participantes.filter((p) => p.status === "confirmed");

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">{nomeDaRodada(rodada)}</p>
        <h1 className="titulo-display text-2xl">
          Quem <span className="texto-ouro">veio?</span>
        </h1>
      </div>

      {confirmados.length === 0 ? (
        <EstadoVazio icone="⚽" titulo="Ninguém confirmado nesta rodada" />
      ) : (
        <ControleDePresenca
          rodadaId={id}
          jogadores={confirmados.map((p) => ({ participacao: p, perfil: p.perfil }))}
          multaPorFaltaCentavos={calcularMulta(rodadaParaDominio(rodada), "no_show")}
        />
      )}
    </div>
  );
}
