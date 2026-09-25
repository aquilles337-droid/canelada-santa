"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { editarRodadaAction } from "@/server/actions/rodadas";
import { Botao } from "@/components/ui/Botao";
import { Campo, AreaTexto } from "@/components/ui/Campo";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { useToast } from "@/components/ui/Toast";

export interface ValoresDaRodada {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  local: string;
  endereco: string;
  vagas: string;
  times: string;
  jogadoresPorTime: string;
  minutos: string;
  gols: string;
  fechamentoData: string;
  fechamentoHora: string;
  regras: string;
  /** Confirmados + chamados da fila. É o piso das vagas. */
  vagasOcupadas: number;
  naEspera: number;
}

/**
 * Edicao de um racha que ja existe.
 *
 * Diferente da criacao, aqui nao tem passo a passo: quem edita ja sabe o que
 * veio mudar e quer chegar no campo direto. O que a tela faz questao de
 * mostrar o tempo todo e o efeito da mudanca nas vagas — e a unica coisa
 * daqui que mexe na vida dos outros.
 */
export function FormularioEditarRodada({ valores }: { valores: ValoresDaRodada }) {
  const router = useRouter();
  const toast = useToast();
  const [estado, acao, enviando] = useActionState(editarRodadaAction, null);

  const [vagas, setVagas] = useState(valores.vagas);

  const numeroDeVagas = Number(vagas);
  const abaixoDoPiso = Number.isFinite(numeroDeVagas) && numeroDeVagas < valores.vagasOcupadas;
  const vagasNovas = Number.isFinite(numeroDeVagas) ? numeroDeVagas - Number(valores.vagas) : 0;
  const chamaDaFila = vagasNovas > 0 && valores.naEspera > 0;

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      const { chamadosDaFila } = estado.dados;
      toast.sucesso(
        chamadosDaFila > 0
          ? `Racha atualizado. ${chamadosDaFila} ${chamadosDaFila === 1 ? "pessoa foi chamada" : "pessoas foram chamadas"} da fila.`
          : "Racha atualizado.",
      );
      router.push(`/admin/rodadas/${valores.id}`);
      router.refresh();
    } else {
      toast.erro(estado.mensagem);
    }
  }, [estado, router, toast, valores.id]);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={valores.id} />

      <Cartao>
        <CabecalhoCartao titulo="Vagas e times" icone={<span aria-hidden>👥</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            type="number"
            name="vagas"
            rotulo="Vagas"
            min={2}
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            erro={
              abaixoDoPiso
                ? `Já tem ${valores.vagasOcupadas} com vaga. Tire alguém da lista antes de reduzir para ${numeroDeVagas}.`
                : null
            }
            ajuda={
              abaixoDoPiso
                ? undefined
                : chamaDaFila
                  ? `Ao salvar, a fila é chamada para preencher ${vagasNovas === 1 ? "a vaga nova" : `as ${vagasNovas} vagas novas`}.`
                  : `${valores.vagasOcupadas} com vaga · ${valores.naEspera} na espera`
            }
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              type="number"
              name="times"
              rotulo="Times"
              min={2}
              defaultValue={valores.times}
              required
            />
            <Campo
              type="number"
              name="jogadoresPorTime"
              rotulo="Por time"
              min={1}
              defaultValue={valores.jogadoresPorTime}
              ajuda="Vazio = divide igual"
            />
          </div>
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Quando e onde" icone={<span aria-hidden>📍</span>} />
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo type="date" name="data" rotulo="Data" defaultValue={valores.data} required />
            <Campo type="time" name="hora" rotulo="Horário" defaultValue={valores.hora} required />
          </div>
          <Campo name="local" rotulo="Local" defaultValue={valores.local} required />
          <Campo
            name="endereco"
            rotulo="Endereço"
            defaultValue={valores.endereco}
            ajuda="Opcional"
          />
          <Campo
            name="titulo"
            rotulo="Nome do racha"
            defaultValue={valores.titulo}
            placeholder="Vazio = numeração automática"
            ajuda="Opcional"
          />
          <p className="text-xs text-cinza-escuro">
            Mudar a data ou o local avisa todo mundo que está na lista.
          </p>
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Formato do jogo" icone={<span aria-hidden>⏱️</span>} />
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo
              type="number"
              name="minutos"
              rotulo="Minutos"
              min={1}
              defaultValue={valores.minutos}
              required
            />
            <Campo
              type="number"
              name="gols"
              rotulo="Gols p/ vencer"
              min={1}
              defaultValue={valores.gols}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              type="date"
              name="fechamentoData"
              rotulo="Lista fecha em"
              defaultValue={valores.fechamentoData}
              required
            />
            <Campo
              type="time"
              name="fechamentoHora"
              rotulo="Às"
              defaultValue={valores.fechamentoHora}
              required
            />
          </div>
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Regras" icone={<span aria-hidden>📋</span>} />
        <AreaTexto
          name="regras"
          rotulo="Regras do racha"
          defaultValue={valores.regras}
          placeholder="Ex.: sem carrinho, chegou depois das 20h entra no próximo jogo…"
          ajuda="Opcional — aparece na página do racha"
          rows={4}
        />
      </Cartao>

      <p className="text-xs text-cinza-escuro">
        O valor do avulso e as multas deste racha não mudam aqui: foram travados quando ele foi
        criado, para não reescrever o que já foi cobrado. Para mudar daqui pra frente, use
        Ajustes.
      </p>

      <div className="flex gap-2">
        <Link href={`/admin/rodadas/${valores.id}`} className="flex-1">
          <Botao type="button" variante="escuro" larguraTotal>
            Cancelar
          </Botao>
        </Link>
        <Botao
          type="submit"
          larguraTotal
          tamanho="lg"
          carregando={enviando}
          disabled={abaixoDoPiso}
          className="flex-1"
        >
          Salvar
        </Botao>
      </div>
    </form>
  );
}
