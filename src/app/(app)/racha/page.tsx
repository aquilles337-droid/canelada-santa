import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listarRodadas, proximaRodada } from "@/server/services/rodadas";
import { clienteAdmin } from "@/lib/supabase/admin";
import { exigirUsuario } from "@/server/auth/sessao";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";

export const metadata: Metadata = { title: "Rachas" };

/** Contagem de confirmados por rodada, numa consulta so. */
async function contarConfirmados(rodadaIds: string[]): Promise<Map<string, number>> {
  if (rodadaIds.length === 0) return new Map();

  const { data } = await clienteAdmin()
    .from("round_participants")
    .select("round_id, status")
    .in("round_id", rodadaIds)
    .in("status", ["confirmed", "invited"]);

  const contagem = new Map<string, number>();
  for (const linha of data ?? []) {
    contagem.set(linha.round_id, (contagem.get(linha.round_id) ?? 0) + 1);
  }
  return contagem;
}

export default async function PaginaRachas() {
  await exigirUsuario();

  const proxima = await proximaRodada();
  if (proxima) redirect(`/racha/${proxima.id}`);

  const anteriores = await listarRodadas({ situacoes: ["finished"], limite: 20 });
  const contagem = await contarConfirmados(anteriores.map((r) => r.id));

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao>
        <CabecalhoCartao titulo="Próximo racha" />
        <EstadoVazio
          icone="📅"
          titulo="Nenhum racha marcado"
          descricao="Assim que um administrador abrir a próxima rodada, ela aparece aqui."
        />
      </Cartao>

      {anteriores.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Rachas anteriores" />
          <div className="flex flex-col gap-3">
            {anteriores.map((rodada) => (
              <CartaoDaRodada
                key={rodada.id}
                rodada={rodada}
                confirmados={contagem.get(rodada.id) ?? 0}
                href={`/racha/${rodada.id}`}
              />
            ))}
          </div>
        </Cartao>
      )}
    </div>
  );
}
