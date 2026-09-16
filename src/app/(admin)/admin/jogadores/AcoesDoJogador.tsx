"use client";

import { useState, useTransition } from "react";
import {
  banirAction,
  definirMensalistaAction,
  definirPapelAction,
  desbanirAction,
  reativarAction,
  suspenderAction,
} from "@/server/actions/jogadores";
import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import type { Resultado } from "@/lib/erros";
import type { Profile } from "@/lib/supabase/tipos";

type Acao = () => Promise<Resultado>;

export function AcoesDoJogador({ jogador, souEu }: { jogador: Profile; souEu: boolean }) {
  const toast = useToast();
  const [executando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);

  const rodar = (acao: Acao, mensagemOk: string) =>
    iniciar(async () => {
      const resultado = await acao();
      if (resultado.ok) toast.sucesso(mensagemOk);
      else toast.erro(resultado.mensagem);
    });

  if (!aberto) {
    return (
      <Botao variante="fantasma" tamanho="sm" onClick={() => setAberto(true)}>
        Gerenciar
      </Botao>
    );
  }

  return (
    <div className="mt-3 flex w-full flex-wrap gap-2 border-t border-linha pt-3">
      <Botao
        variante={jogador.is_member ? "contorno" : "escuro"}
        tamanho="sm"
        disabled={executando}
        onClick={() =>
          rodar(
            () => definirMensalistaAction(jogador.id, !jogador.is_member),
            jogador.is_member ? "Agora é avulso." : "Agora é mensalista.",
          )
        }
      >
        {jogador.is_member ? "Tirar mensalista" : "Tornar mensalista"}
      </Botao>

      {!souEu && (
        <Botao
          variante="escuro"
          tamanho="sm"
          disabled={executando}
          onClick={() =>
            rodar(
              () => definirPapelAction(jogador.id, jogador.role !== "admin"),
              jogador.role === "admin" ? "Deixou de ser administrador." : "Agora é administrador.",
            )
          }
        >
          {jogador.role === "admin" ? "Tirar admin" : "Tornar admin"}
        </Botao>
      )}

      {jogador.status === "active" && !souEu && (
        <>
          <Botao
            variante="escuro"
            tamanho="sm"
            disabled={executando}
            onClick={() => rodar(() => suspenderAction(jogador.id), "Jogador suspenso.")}
          >
            Suspender
          </Botao>
          <Botao
            variante="perigo"
            tamanho="sm"
            disabled={executando}
            onClick={() => rodar(() => banirAction(jogador.id), "Jogador bloqueado.")}
          >
            Banir
          </Botao>
        </>
      )}

      {jogador.status === "suspended" && (
        <Botao
          variante="sucesso"
          tamanho="sm"
          disabled={executando}
          onClick={() => rodar(() => reativarAction(jogador.id), "Jogador reativado.")}
        >
          Reativar
        </Botao>
      )}

      {jogador.status === "banned" && (
        <Botao
          variante="sucesso"
          tamanho="sm"
          disabled={executando}
          onClick={() => rodar(() => desbanirAction(jogador.id), "Jogador desbloqueado.")}
        >
          Desbanir
        </Botao>
      )}

      <Botao variante="fantasma" tamanho="sm" onClick={() => setAberto(false)}>
        Fechar
      </Botao>
    </div>
  );
}
