import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { listarTemporadas } from "@/server/services/temporadas";
import { listarRodadas } from "@/server/services/rodadas";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarData } from "@/lib/format";

export const metadata: Metadata = { title: "Temporadas" };

export default async function PaginaTemporadas() {
  await exigirAdmin();

  const temporadas = await listarTemporadas();
  const rodadas = await listarRodadas({ limite: 500 });

  const porTemporada = new Map<string, number>();
  for (const rodada of rodadas) {
    porTemporada.set(rodada.season_id, (porTemporada.get(rodada.season_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <h1 className="titulo-display text-2xl">Temporadas</h1>
        <p className="mt-1 text-xs text-cinza">
          A temporada vira sozinha na data configurada. O histórico antigo nunca é apagado: cria-se
          uma temporada nova e as estatísticas passam a contar nela.
        </p>
      </div>

      {temporadas.length === 0 ? (
        <EstadoVazio icone="📆" titulo="Nenhuma temporada ainda" />
      ) : (
        <Cartao>
          <CabecalhoCartao titulo={`${temporadas.length} temporada(s)`} />
          <ul className="flex flex-col divide-y divide-linha">
            {temporadas.map((temporada) => (
              <li key={temporada.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{temporada.name}</p>
                  <p className="text-[11px] text-cinza-escuro">
                    {formatarData(temporada.starts_on)} até {formatarData(temporada.ends_on)} ·{" "}
                    {porTemporada.get(temporada.id) ?? 0} racha(s)
                  </p>
                </div>
                {temporada.is_current && <Selo tom="ouro">Atual</Selo>}
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
