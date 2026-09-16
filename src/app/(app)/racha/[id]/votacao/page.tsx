import type { Metadata } from "next";
import { exigirAtivo } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { apuracaoDaRodada, meusVotosNaRodada } from "@/server/services/votacao";
import { EstadoVazio } from "@/components/ui/Estados";
import { Votacao } from "./Votacao";

export const metadata: Metadata = { title: "Votação" };

export default async function PaginaVotacao({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirAtivo();
  const { id } = await params;

  const { rodada, participantes } = await carregarRodada(id);
  const presentes = participantes.filter((p) => p.attendance === "present");

  const [craque, bagre, meusVotos] = await Promise.all([
    apuracaoDaRodada(id, "mvp"),
    apuracaoDaRodada(id, "bagre"),
    meusVotosNaRodada(id, perfil.id),
  ]);

  const euJoguei = presentes.some((p) => p.profile_id === perfil.id);
  const rodadaFinalizada = rodada.status === "finished";

  const candidatos = presentes
    .filter((p) => p.profile_id !== perfil.id)
    .map((p) => ({
      profileId: p.profile_id,
      nome: p.perfil.nickname?.trim() || p.perfil.full_name,
      fotoUrl: p.perfil.photo_url,
      ehGoleiro: p.perfil.is_goalkeeper,
    }));

  const motivo = !rodadaFinalizada
    ? "A votação abre quando o racha terminar."
    : !euJoguei
      ? "Só quem jogou esta rodada pode votar."
      : null;

  if (presentes.length === 0) {
    return (
      <div className="flex flex-col gap-4 animate-subir">
        <h1 className="titulo-display text-2xl">Votação</h1>
        <EstadoVazio
          icone="📋"
          titulo="Presença ainda não registrada"
          descricao="A votação abre depois que o administrador marcar quem veio."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">{nomeDaRodada(rodada)}</p>
        <h1 className="titulo-display text-2xl">
          Craque e <span className="texto-ouro">bagre</span>
        </h1>
      </div>

      <Votacao
        rodadaId={id}
        tipo="mvp"
        candidatos={candidatos}
        meuVoto={meusVotos.mvp ?? null}
        resultado={craque}
        podeVotar={rodadaFinalizada && euJoguei}
        motivo={motivo}
      />

      <Votacao
        rodadaId={id}
        tipo="bagre"
        candidatos={candidatos}
        meuVoto={meusVotos.bagre ?? null}
        resultado={bagre}
        podeVotar={rodadaFinalizada && euJoguei}
        motivo={motivo}
      />
    </div>
  );
}
