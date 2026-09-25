"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirJogoAction } from "@/server/actions/partidas";
import { Botao } from "@/components/ui/Botao";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

export interface TimeParaEscolher {
  id: string;
  name: string;
  color: string;
}

const CORES: Record<string, string> = {
  ouro: "border-time-1 text-time-1",
  azul: "border-time-2 text-time-2",
  vermelho: "border-time-3 text-time-3",
  branco: "border-time-4 text-time-4",
  verde: "border-time-5 text-time-5",
  roxo: "border-time-6 text-time-6",
};

/**
 * Escolha de quem abre o jogo.
 *
 * Por padrão entram os dois primeiros times, que são os mais fortes — o
 * sorteio ordena por força. Mas quem está na quadra costuma ter motivo para
 * começar com outros dois (quem chegou primeiro, quem ficou de fora no
 * último racha), e essa decisão é de lá, não do sistema.
 *
 * Quem não entra vai para a fila na ordem dos times, e daí em diante manda a
 * regra do "quem ganha fica".
 */
export function AbrirJogo({
  rodadaId,
  times,
}: {
  rodadaId: string;
  times: TimeParaEscolher[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [abrindo, iniciar] = useTransition();

  const [escolhaA, setEscolhaA] = useState(times[0]?.id ?? "");
  const [escolhaB, setEscolhaB] = useState(times[1]?.id ?? "");

  // Gerar os times de novo troca os ids, e a escolha guardada aqui viraria
  // lixo — o servidor recusaria times que não são mais da rodada. Por isso a
  // escolha é conferida na renderização e cai no padrão quando não vale
  // mais, em vez de ser corrigida num efeito depois de já ter aparecido
  // errada na tela.
  const existentes = new Set(times.map((t) => t.id));
  const ladoA = existentes.has(escolhaA) ? escolhaA : (times[0]?.id ?? "");
  const ladoB =
    existentes.has(escolhaB) && escolhaB !== ladoA
      ? escolhaB
      : (times.find((t) => t.id !== ladoA)?.id ?? "");

  if (times.length < 2) {
    return (
      <EstadoVazio
        icone="🎽"
        titulo="Gere os times primeiro"
        descricao="O modo jogo precisa dos times sorteados para montar as partidas."
      />
    );
  }

  // Escolher um time que já está do outro lado troca os dois de lugar, em
  // vez de deixar o mesmo time nos dois lados.
  const escolher = (lado: "A" | "B", id: string) => {
    if (lado === "A") {
      if (id === ladoB) setEscolhaB(ladoA);
      setEscolhaA(id);
    } else {
      if (id === ladoA) setEscolhaA(ladoB);
      setEscolhaB(id);
    }
  };

  const naFila = times.filter((t) => t.id !== ladoA && t.id !== ladoB);

  const linhaDeEscolha = (lado: "A" | "B", selecionado: string) => (
    <div className="flex flex-wrap gap-2">
      {times.map((time) => {
        const ativo = time.id === selecionado;
        return (
          <button
            key={time.id}
            type="button"
            onClick={() => escolher(lado, time.id)}
            aria-pressed={ativo}
            className={cn(
              "min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors",
              ativo
                ? cn("bg-carvao font-semibold", CORES[time.color] ?? "border-ouro text-ouro")
                : "border-linha text-cinza hover:text-osso",
            )}
          >
            {time.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Cartao>
        <CabecalhoCartao titulo="Quem começa?" icone={<span aria-hidden>🏟️</span>} />

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-cinza">Lado A</p>
            {linhaDeEscolha("A", ladoA)}
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-cinza">Lado B</p>
            {linhaDeEscolha("B", ladoB)}
          </div>
        </div>

        {naFila.length > 0 && (
          <p className="mt-4 border-t border-linha pt-3 text-xs text-cinza-escuro">
            Na fila, nesta ordem: {naFila.map((t) => t.name).join(", ")}.
          </p>
        )}
      </Cartao>

      <Botao
        tamanho="xl"
        larguraTotal
        carregando={abrindo}
        disabled={!ladoA || !ladoB || ladoA === ladoB}
        onClick={() =>
          iniciar(async () => {
            const resultado = await abrirJogoAction(rodadaId, ladoA, ladoB);
            if (resultado.ok) router.refresh();
            else toast.erro(resultado.mensagem);
          })
        }
      >
        Abrir o jogo
      </Botao>

      <p className="text-center text-xs text-cinza-escuro">
        Quem ganhar fica. O perdedor vai para o fim da fila.
      </p>
    </div>
  );
}
