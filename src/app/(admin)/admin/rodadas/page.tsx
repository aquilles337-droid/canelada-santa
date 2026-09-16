import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/server/auth/sessao";
import { listarRodadas } from "@/server/services/rodadas";
import { clienteAdmin } from "@/lib/supabase/admin";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";

export const metadata: Metadata = { title: "Rachas" };

async function contarPorRodada(rodadaIds: string[]) {
  if (rodadaIds.length === 0) return new Map<string, { confirmados: number; esperando: number }>();

  const { data } = await clienteAdmin()
    .from("round_participants")
    .select("round_id, status")
    .in("round_id", rodadaIds)
    .in("status", ["confirmed", "invited", "waiting"]);

  const mapa = new Map<string, { confirmados: number; esperando: number }>();
  for (const linha of data ?? []) {
    const atual = mapa.get(linha.round_id) ?? { confirmados: 0, esperando: 0 };
    if (linha.status === "waiting") atual.esperando += 1;
    else atual.confirmados += 1;
    mapa.set(linha.round_id, atual);
  }
  return mapa;
}

export default async function PaginaAdminRodadas() {
  await exigirAdmin();

  const rodadas = await listarRodadas({ limite: 40 });
  const contagem = await contarPorRodada(rodadas.map((r) => r.id));

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="flex items-center justify-between gap-3">
        <h1 className="titulo-display text-2xl">Rachas</h1>
        <Link href="/admin/rodadas/nova">
          <Botao tamanho="sm">Novo racha</Botao>
        </Link>
      </div>

      {rodadas.length === 0 ? (
        <EstadoVazio
          icone="⚽"
          titulo="Nenhum racha ainda"
          descricao="Crie a primeira rodada e a lista abre para o grupo."
          acao={
            <Link href="/admin/rodadas/nova">
              <Botao>Criar racha</Botao>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rodadas.map((rodada) => {
            const numeros = contagem.get(rodada.id) ?? { confirmados: 0, esperando: 0 };
            return (
              <CartaoDaRodada
                key={rodada.id}
                rodada={rodada}
                confirmados={numeros.confirmados}
                esperando={numeros.esperando}
                href={`/admin/rodadas/${rodada.id}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
