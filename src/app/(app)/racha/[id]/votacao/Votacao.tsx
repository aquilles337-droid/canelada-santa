"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { votarAction } from "@/server/actions/estatisticas";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { useToast } from "@/components/ui/Toast";
import type { VoteKind } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

export interface CandidatoAVoto {
  profileId: string;
  nome: string;
  fotoUrl: string | null;
  ehGoleiro: boolean;
}

export interface ResultadoDaVotacao {
  contagem: { profileId: string; nome: string; fotoUrl: string | null; votos: number }[];
  vencedorId: string | null;
  empate: boolean;
  totalDeVotos: number;
}

const ESTILO: Record<VoteKind, { titulo: string; emoji: string; tom: "ouro" | "vermelho" }> = {
  mvp: { titulo: "Craque da rodada", emoji: "🏆", tom: "ouro" },
  bagre: { titulo: "Bagre da rodada", emoji: "🥔", tom: "vermelho" },
};

/**
 * Votação de craque e bagre.
 *
 * O voto é anônimo: a tela mostra a contagem, nunca quem votou em quem. Os
 * resultados aparecem progressivamente, conforme o pessoal vota.
 */
export function Votacao({
  rodadaId,
  tipo,
  candidatos,
  meuVoto,
  resultado,
  podeVotar,
  motivo,
}: {
  rodadaId: string;
  tipo: VoteKind;
  candidatos: CandidatoAVoto[];
  meuVoto: string | null;
  resultado: ResultadoDaVotacao;
  podeVotar: boolean;
  motivo: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [votando, iniciar] = useTransition();
  const [escolhido, setEscolhido] = useState<string | null>(meuVoto);

  const estilo = ESTILO[tipo];
  const lider = resultado.contagem[0];

  const votar = (profileId: string) =>
    iniciar(async () => {
      const resultadoDaAcao = await votarAction(rodadaId, profileId, tipo);
      if (resultadoDaAcao.ok) {
        setEscolhido(profileId);
        toast.sucesso("Voto registrado. Ninguém vai saber que foi você. 🤫");
        router.refresh();
      } else {
        toast.erro(resultadoDaAcao.mensagem);
      }
    });

  return (
    <Cartao>
      <CabecalhoCartao
        titulo={estilo.titulo}
        icone={<span aria-hidden>{estilo.emoji}</span>}
        acao={<Selo tom="neutro">{resultado.totalDeVotos} voto(s)</Selo>}
      />

      {resultado.vencedorId && lider && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-linha bg-carvao/60 p-3">
          <span aria-hidden className="text-3xl">
            {estilo.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-cinza">Liderando</p>
            <p className="titulo-display truncate text-lg">{lider.nome}</p>
          </div>
          <Selo tom={estilo.tom}>{lider.votos} voto(s)</Selo>
        </div>
      )}

      {resultado.empate && resultado.totalDeVotos > 0 && (
        <p className="mb-3 rounded-xl border border-ambar/40 bg-ambar/10 px-4 py-2.5 text-sm text-ambar">
          A disputa está empatada. Ainda dá para virar.
        </p>
      )}

      {!podeVotar ? (
        <p className="rounded-xl border border-linha bg-carvao/50 px-4 py-3 text-sm text-cinza">
          {motivo ?? "Você não pode votar nesta rodada."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {candidatos.map((candidato) => {
            const votos = resultado.contagem.find((c) => c.profileId === candidato.profileId)?.votos ?? 0;
            const ehMeuVoto = escolhido === candidato.profileId;

            return (
              <li key={candidato.profileId}>
                <button
                  type="button"
                  disabled={votando}
                  onClick={() => votar(candidato.profileId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    ehMeuVoto
                      ? "border-ouro/60 bg-ouro/10"
                      : "border-linha bg-carvao/50 hover:border-ouro/30",
                  )}
                >
                  <Avatar
                    nome={candidato.nome}
                    fotoUrl={candidato.fotoUrl}
                    tamanho="sm"
                    goleiro={candidato.ehGoleiro}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{candidato.nome}</span>
                  {votos > 0 && <Selo tom="neutro">{votos}</Selo>}
                  {ehMeuVoto && <Selo tom={estilo.tom}>Meu voto</Selo>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-cinza-escuro">
        Votação anônima. Você pode mudar seu voto enquanto a apuração estiver aberta.
      </p>
    </Cartao>
  );
}
