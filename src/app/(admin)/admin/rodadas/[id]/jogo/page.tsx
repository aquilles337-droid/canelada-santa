import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { estadoDoJogo } from "@/server/services/partidas";
import { ModoJogo } from "@/components/jogo/ModoJogo";
import { AbrirJogo } from "./AbrirJogo";

export const metadata: Metadata = { title: "Modo jogo" };

export default async function PaginaModoJogo({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;

  const [{ rodada }, estado] = await Promise.all([carregarRodada(id), estadoDoJogo(id)]);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">{nomeDaRodada(rodada)}</p>
        <h1 className="titulo-display text-2xl">
          Modo <span className="texto-ouro">jogo</span>
        </h1>
      </div>

      {estado.partidaAtual ? (
        <ModoJogo rodadaId={id} estado={estado} />
      ) : (
        <AbrirJogo
          rodadaId={id}
          times={estado.times.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        />
      )}
    </div>
  );
}
