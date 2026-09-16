"use client";

import { useState, useTransition } from "react";
import { avaliarAction } from "@/server/actions/avaliacoes";
import { Avatar } from "@/components/ui/Avatar";
import { Selo } from "@/components/ui/Selo";
import { useToast } from "@/components/ui/Toast";
import { formatarNota } from "@/lib/format";
import type { CategoriaNota } from "@/lib/supabase/tipos";
import { categoriaDaNota } from "@/domain/avaliacoes";
import { cn } from "@/lib/utils";

const TOM_POR_CATEGORIA: Record<string, "vermelho" | "ambar" | "neutro" | "azul" | "ouro"> = {
  bagre: "vermelho",
  iniciante: "ambar",
  regular: "neutro",
  bom: "azul",
  craque: "ouro",
};

/**
 * Avaliação de um jogador.
 *
 * A votação é anônima: ninguém, nem o avaliado, vê quem deu qual nota. O
 * jogador pode mudar a própria nota quando quiser — vale a última.
 */
export function AvaliarJogador({
  jogador,
  minhaNota,
  categorias,
}: {
  jogador: { id: string; nome: string; fotoUrl: string | null; ehGoleiro: boolean };
  minhaNota: number | null;
  categorias: CategoriaNota[];
}) {
  const toast = useToast();
  const [nota, setNota] = useState<number>(minhaNota ?? 5);
  const [salva, setSalva] = useState<number | null>(minhaNota);
  const [salvando, iniciar] = useTransition();

  const categoria = categoriaDaNota(nota, categorias);
  const mudou = salva === null || Math.abs(salva - nota) > 0.001;

  const salvar = () =>
    iniciar(async () => {
      const resultado = await avaliarAction(jogador.id, nota);
      if (resultado.ok) {
        setSalva(nota);
        toast.sucesso(`Avaliação de ${jogador.nome} registrada.`);
      } else {
        toast.erro(resultado.mensagem);
      }
    });

  return (
    <li className="flex flex-col gap-2.5 py-3.5">
      <div className="flex items-center gap-3">
        <Avatar nome={jogador.nome} fotoUrl={jogador.fotoUrl} tamanho="sm" goleiro={jogador.ehGoleiro} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{jogador.nome}</p>

        <span className="titulo-display w-12 text-right text-xl tabular-nums texto-ouro">
          {formatarNota(nota)}
        </span>
        {categoria && (
          <Selo tom={TOM_POR_CATEGORIA[categoria.slug] ?? "neutro"}>{categoria.label}</Selo>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={nota}
          onChange={(e) => setNota(Number(e.target.value))}
          aria-label={`Nota de ${jogador.nome}`}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-elevado accent-[#c9a227]"
        />

        <button
          type="button"
          onClick={salvar}
          disabled={!mudou || salvando}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
            mudou
              ? "bg-ouro text-carvao hover:bg-ouro-claro"
              : "border border-linha text-cinza-escuro",
          )}
        >
          {salvando ? "…" : mudou ? "Salvar" : "Salvo"}
        </button>
      </div>
    </li>
  );
}
