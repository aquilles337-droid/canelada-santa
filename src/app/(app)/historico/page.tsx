import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/server/auth/sessao";
import { listarRodadas } from "@/server/services/rodadas";
import { listarTemporadas } from "@/server/services/temporadas";
import { clienteAdmin } from "@/lib/supabase/admin";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";

export const metadata: Metadata = { title: "Histórico" };

/** Todas as rodadas já disputadas, da mais recente para a mais antiga. */
export default async function PaginaHistorico() {
  await exigirUsuario();

  const [rodadas, temporadas] = await Promise.all([
    listarRodadas({ situacoes: ["finished", "cancelled"], limite: 60 }),
    listarTemporadas(),
  ]);

  const { data: presencas } = await clienteAdmin()
    .from("round_participants")
    .select("round_id, attendance")
    .in("round_id", rodadas.length > 0 ? rodadas.map((r) => r.id) : ["sem-rodadas"])
    .eq("attendance", "present");

  const contagem = new Map<string, number>();
  for (const linha of presencas ?? []) {
    contagem.set(linha.round_id, (contagem.get(linha.round_id) ?? 0) + 1);
  }

  const porTemporada = new Map<string, typeof rodadas>();
  for (const rodada of rodadas) {
    const lista = porTemporada.get(rodada.season_id) ?? [];
    lista.push(rodada);
    porTemporada.set(rodada.season_id, lista);
  }

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="flex items-end justify-between gap-3">
        <h1 className="titulo-display text-2xl">
          Nosso <span className="texto-ouro">histórico</span>
        </h1>
        <div className="flex gap-2">
          <Link href="/hall-da-fama">
            <Botao variante="escuro" tamanho="sm">
              Hall da Fama
            </Botao>
          </Link>
          <Link href="/resenha">
            <Botao variante="escuro" tamanho="sm">
              Resenha
            </Botao>
          </Link>
        </div>
      </div>

      {rodadas.length === 0 ? (
        <EstadoVazio
          icone="📚"
          titulo="Nenhum racha encerrado ainda"
          descricao="Quando o primeiro racha terminar, ele fica guardado aqui para sempre."
        />
      ) : (
        [...porTemporada.entries()].map(([temporadaId, doPeriodo]) => {
          const temporada = temporadas.find((t) => t.id === temporadaId);

          return (
            <section key={temporadaId} className="flex flex-col gap-3">
              <h2 className="titulo-display text-sm text-cinza">
                {temporada?.name ?? "Temporada"}
                <span className="ml-2 font-sans text-xs font-normal normal-case tracking-normal text-cinza-escuro">
                  {doPeriodo.length} racha(s)
                </span>
              </h2>

              {doPeriodo.map((rodada) => (
                <CartaoDaRodada
                  key={rodada.id}
                  rodada={rodada}
                  confirmados={contagem.get(rodada.id) ?? 0}
                  href={`/racha/${rodada.id}`}
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
