"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarConvidadoAction, removerConvidadoAction } from "@/server/actions/convidados";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { useToast } from "@/components/ui/Toast";
import { formatarDinheiro, plural } from "@/lib/format";
import type { RoundGuest } from "@/lib/supabase/tipos";

export interface CotaDeConvidados {
  cota: number;
  usados: number;
  restantes: number;
  podeLevar: boolean;
  motivo: string | null;
  precoCentavos: number;
}

/**
 * Convidados do jogador nesta rodada.
 *
 * O convidado nao tem conta: ele fica preso a quem levou, que gasta uma cota
 * do mes e paga por ele. A vaga so e garantida se sobrar lugar depois de
 * todos os jogadores do grupo.
 */
export function PainelDeConvidados({
  rodadaId,
  meusConvidados,
  cota,
}: {
  rodadaId: string;
  meusConvidados: RoundGuest[];
  cota: CotaDeConvidados;
}) {
  const toast = useToast();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [removendo, iniciarRemocao] = useTransition();
  const [estado, acao, enviando] = useActionState(adicionarConvidadoAction, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.sucesso("Convidado cadastrado. A vaga dele sai quando a lista fechar.");
      router.refresh();
    } else {
      toast.erro(estado.mensagem);
    }
  }, [estado, router, toast]);

  const ativos = meusConvidados.filter((c) => c.status !== "cancelled" && c.status !== "removed");

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Meus convidados"
        icone={<span aria-hidden>🎟️</span>}
        acao={
          <Selo tom={cota.restantes > 0 ? "ouro" : "neutro"}>
            {plural(cota.restantes, "restante", "restantes")}
          </Selo>
        }
      />

      {ativos.length > 0 && (
        <ul className="mb-3 flex flex-col divide-y divide-linha">
          {ativos.map((convidado) => (
            <li key={convidado.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{convidado.name}</p>
                <p className="text-[11px] text-cinza-escuro">Nível {convidado.skill_level}</p>
              </div>
              <Selo tom={convidado.status === "confirmed" ? "verde" : "ambar"}>
                {convidado.status === "confirmed" ? "Confirmado" : "Aguarda vaga"}
              </Selo>
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={removendo}
                onClick={() =>
                  iniciarRemocao(async () => {
                    const resultado = await removerConvidadoAction(convidado.id, rodadaId);
                    if (resultado.ok) {
                      toast.mostrar("Convidado retirado.", "aviso");
                      router.refresh();
                    } else {
                      toast.erro(resultado.mensagem);
                    }
                  })
                }
              >
                Tirar
              </Botao>
            </li>
          ))}
        </ul>
      )}

      {!cota.podeLevar ? (
        <p className="rounded-xl border border-linha bg-carvao/50 px-4 py-3 text-sm text-cinza">
          {cota.motivo ?? "Você não pode levar convidado neste racha."}
        </p>
      ) : aberto ? (
        <form action={acao} className="flex flex-col gap-3">
          <input type="hidden" name="rodadaId" value={rodadaId} />
          <Campo name="nome" rotulo="Nome do convidado" placeholder="Nome e sobrenome" required />
          <Campo
            name="nivel"
            rotulo="Nível de 0 a 10"
            type="number"
            min={0}
            max={10}
            step={0.5}
            defaultValue={5}
            ajuda="Ajuda o sorteio a equilibrar os times"
            required
          />
          <p className="text-xs text-cinza">
            Você paga {formatarDinheiro(cota.precoCentavos)} por este convidado. Ele só entra se
            sobrar vaga depois dos jogadores do grupo.
          </p>
          <div className="flex gap-2">
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" larguraTotal carregando={enviando}>
              Cadastrar
            </Botao>
          </div>
        </form>
      ) : (
        <Botao variante="escuro" larguraTotal onClick={() => setAberto(true)}>
          Levar convidado
        </Botao>
      )}
    </Cartao>
  );
}
