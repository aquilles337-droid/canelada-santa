"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cadastrar } from "@/server/actions/cadastro";
import { Botao } from "@/components/ui/Botao";
import { Campo, Selecao } from "@/components/ui/Campo";
import { mascararTelefone } from "@/lib/phone";

export function FormularioCadastro({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState("linha");
  const [estado, acao, enviando] = useActionState(cadastrar, null);

  useEffect(() => {
    if (estado?.ok) {
      router.replace(estado.dados.destino);
      router.refresh();
    }
  }, [estado, router]);

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="codigo" value={codigo} />

      <Campo name="nome" rotulo="Nome completo" autoComplete="name" placeholder="João da Silva" required />

      <Campo
        name="telefone"
        rotulo="Telefone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="(82) 98888-7777"
        ajuda="É com ele que você entra no aplicativo."
        value={telefone}
        onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Campo name="senha" rotulo="Senha" type="password" autoComplete="new-password" required />
        <Campo name="confirmacao" rotulo="Repita a senha" type="password" autoComplete="new-password" required />
      </div>

      <Selecao
        name="posicao"
        rotulo="Posição"
        value={posicao}
        onChange={(e) => setPosicao(e.target.value)}
        required
      >
        <option value="linha">Linha</option>
        <option value="fixo">Fixo</option>
        <option value="ala">Ala</option>
        <option value="pivo">Pivô</option>
        <option value="goleiro">Goleiro</option>
      </Selecao>

      {posicao !== "goleiro" && (
        <label className="flex items-center gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            name="goleiro"
            className="size-5 accent-[#c9a227]"
          />
          <span className="text-sm text-osso">
            Também pego de goleiro
            <span className="block text-xs text-cinza-escuro">
              Ajuda o sorteio a distribuir um goleiro por time.
            </span>
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo name="peso" rotulo="Peso (kg)" type="text" inputMode="decimal" placeholder="78" ajuda="Opcional" />
        <Campo name="altura" rotulo="Altura (cm)" type="text" inputMode="numeric" placeholder="178" ajuda="Opcional" />
      </div>

      {estado && !estado.ok && (
        <p className="rounded-xl border border-vermelho/40 bg-vermelho/10 px-4 py-3 text-sm text-vermelho">
          {estado.mensagem}
        </p>
      )}

      <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
        Entrar no Canelada Santa
      </Botao>
    </form>
  );
}
